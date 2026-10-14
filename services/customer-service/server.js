
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Kết nối PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Kiểm tra kết nối database và tạo bảng
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT UNIQUE NOT NULL,
                full_name VARCHAR(100),
                phone VARCHAR(20),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Customer database connected");
    } catch (error) {
        console.error("Database initialization error:", error.message);
        throw error;
    }
}

// Trang chủ
app.get("/", (req, res) => {
    res.status(200).send("Customer Service is running!");
});

// Health check
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            service: "customer-service",
            status: "healthy",
            database: "connected"
        });
    } catch (error) {
        res.status(503).json({
            service: "customer-service",
            status: "unhealthy",
            database: "disconnected"
        });
    }
});

// Tạo hồ sơ khách hàng
app.post("/customers", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { full_name, phone, address } = req.body;

        if (!userId) {
            return res.status(401).json({
                message: "User ID not found in token"
            });
        }

        const result = await pool.query(
            `INSERT INTO customers (user_id, full_name, phone, address)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id)
             DO UPDATE SET
                full_name = EXCLUDED.full_name,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, full_name || null, phone || null, address || null]
        );

        res.status(201).json({
            message: "Customer profile saved successfully",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Create customer error:", error.message);
        res.status(500).json({
            message: "Failed to save customer profile"
        });
    }
});

// Lấy hồ sơ khách hàng đang đăng nhập
app.get("/customers/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        if (!userId) {
            return res.status(401).json({
                message: "User ID not found in token"
            });
        }

        const result = await pool.query(
            "SELECT * FROM customers WHERE user_id = $1",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer profile not found"
            });
        }

        res.status(200).json({
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Get customer error:", error.message);
        res.status(500).json({
            message: "Failed to retrieve customer profile"
        });
    }
});

// Cập nhật hồ sơ khách hàng đang đăng nhập
app.put("/customers/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { full_name, phone, address } = req.body;

        if (!userId) {
            return res.status(401).json({
                message: "User ID not found in token"
            });
        }

        const result = await pool.query(
            `UPDATE customers
             SET full_name = COALESCE($1, full_name),
                 phone = COALESCE($2, phone),
                 address = COALESCE($3, address),
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $4
             RETURNING *`,
            [
                full_name ?? null,
                phone ?? null,
                address ?? null,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer profile not found"
            });
        }

        res.status(200).json({
            message: "Customer profile updated successfully",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Update customer error:", error.message);
        res.status(500).json({
            message: "Failed to update customer profile"
        });
    }
});

// Xử lý lỗi JSON không hợp lệ
app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(400).json({
        message: "Invalid request"
    });
});

// Khởi động service sau khi kết nối database
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Customer Service running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Cannot start Customer Service:", error.message);
        process.exit(1);
    }
}

startServer();
