const express = require("express");
require("dotenv").config();

const pool = require("./db");

const app = express();
app.use(express.json());

// Kiểm tra sức khỏe Order Service và PostgreSQL
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            service: "order-service",
            status: "healthy",
            database: "connected"
        });
    } catch (error) {
        res.status(503).json({
            service: "order-service",
            status: "unhealthy",
            database: "disconnected"
        });
    }
});
// Tạo đơn hàng và các chi tiết đơn hàng
app.post("/orders", async (req, res) => {
    const { customer_id, items } = req.body;

    if (
        !Number.isSafeInteger(customer_id) ||
        customer_id <= 0 ||
        !Array.isArray(items) ||
        items.length === 0
    ) {
        return res.status(400).json({
            message: "customer_id phải là số nguyên dương và items không được rỗng"
        });
    }

    for (const item of items) {
        if (
            typeof item.product_id !== "string" ||
            !item.product_id.trim() ||
            typeof item.product_name !== "string" ||
            !item.product_name.trim() ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            typeof item.unit_price !== "number" ||
            !Number.isFinite(item.unit_price) ||
            item.unit_price < 0
        ) {
            return res.status(400).json({
                message: "Mỗi sản phẩm cần product_id, product_name, quantity hợp lệ và unit_price không âm"
            });
        }
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const totalAmount = items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
        );

        if (!Number.isFinite(totalAmount) || totalAmount > 9999999999.99) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Tổng tiền đơn hàng không hợp lệ hoặc vượt giới hạn"
            });
        }

        const orderResult = await client.query(
            `INSERT INTO orders (customer_id, total_amount)
             VALUES ($1, $2)
             RETURNING *`,
            [customer_id, totalAmount.toFixed(2)]
        );

        const order = orderResult.rows[0];
        const details = [];

        for (const item of items) {
            const detailResult = await client.query(
                `INSERT INTO order_details
                    (order_id, product_id, product_name, quantity, unit_price)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [
                    order.id,
                    item.product_id.trim(),
                    item.product_name.trim(),
                    item.quantity,
                    item.unit_price.toFixed(2)
                ]
            );

            details.push(detailResult.rows[0]);
        }

        await client.query("COMMIT");

        res.status(201).json({
            message: "Tạo đơn hàng thành công",
            order,
            details
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Create order error:", error.message);

        res.status(500).json({
            message: "Không thể tạo đơn hàng"
        });
    } finally {
        client.release();
    }
});
app.put("/orders/:id/status", async (req, res) => {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled"
    ];

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
            message: "ID đơn hàng không hợp lệ"
        });
    }

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: "Trạng thái đơn hàng không hợp lệ",
            allowedStatuses
        });
    }

    try {
        const result = await pool.query(
            `UPDATE orders
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, orderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy đơn hàng"
            });
        }

        res.status(200).json({
            message: "Cập nhật trạng thái đơn hàng thành công",
            order: result.rows[0]
        });
    } catch (error) {
        console.error("Update order status error:", error.message);

        res.status(500).json({
            message: "Không thể cập nhật trạng thái đơn hàng"
        });
    }
});
// Lấy danh sách đơn hàng
app.get("/orders", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                o.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', d.id,
                            'product_id', d.product_id,
                            'product_name', d.product_name,
                            'quantity', d.quantity,
                            'unit_price', d.unit_price,
                            'subtotal', d.subtotal
                        )
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'
                ) AS details
            FROM orders o
            LEFT JOIN order_details d ON d.order_id = o.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `);

        res.status(200).json({
            count: result.rows.length,
            orders: result.rows
        });
    } catch (error) {
        console.error("Get orders error:", error.message);

        res.status(500).json({
            message: "Lỗi khi lấy danh sách đơn hàng"
        });
    }
});

// Lấy chi tiết một đơn hàng
app.get("/orders/:id", async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                message: "ID đơn hàng không hợp lệ"
            });
        }

        const orderResult = await pool.query(
            "SELECT * FROM orders WHERE id = $1",
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy đơn hàng"
            });
        }

        const detailResult = await pool.query(
            `SELECT id, product_id, product_name, quantity,
                    unit_price, subtotal
             FROM order_details
             WHERE order_id = $1
             ORDER BY id`,
            [orderId]
        );

        res.status(200).json({
            order: orderResult.rows[0],
            details: detailResult.rows
        });
    } catch (error) {
        console.error("Get order error:", error.message);

        res.status(500).json({
            message: "Lỗi khi lấy chi tiết đơn hàng"
        });
    }
});

// Khởi động Order Service
async function startServer() {
    try {
        await pool.query("SELECT 1");

        const PORT = process.env.PORT || 3007;

        app.listen(PORT, () => {
            console.log("PostgreSQL connected");
            console.log(`Order Service running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();