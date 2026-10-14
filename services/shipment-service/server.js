
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());

// Schema giao hàng
const shipmentSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        trim: true
    },
    customerId: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["pending", "shipping", "delivered", "cancelled"],
        default: "pending"
    },
    trackingCode: {
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true
});

const Shipment = mongoose.model("Shipment", shipmentSchema);

// Kiểm tra sức khỏe service và MongoDB
app.get("/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;

    res.status(connected ? 200 : 503).json({
        service: "shipment-service",
        status: connected ? "healthy" : "unhealthy",
        database: connected ? "connected" : "disconnected"
    });
});
// Tạo đơn giao hàng
app.post("/shipments", async (req, res) => {
    try {
        const { orderId, customerId, address } = req.body;

        if (!orderId || !customerId || !address) {
            return res.status(400).json({
                message: "Vui lòng cung cấp orderId, customerId và address"
            });
        }

        const shipment = await Shipment.create({
            orderId,
            customerId,
            address
        });

        res.status(201).json({
            message: "Tạo đơn giao hàng thành công",
            shipment
        });
    } catch (error) {
        console.error("Create shipment error:", error.message);

        res.status(400).json({
            message: "Không thể tạo đơn giao hàng",
            error: error.message
        });
    }
});
// Cập nhật trạng thái giao hàng
app.put("/shipments/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "pending",
            "shipping",
            "delivered",
            "cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Trạng thái giao hàng không hợp lệ",
                allowedStatuses
            });
        }

        const shipment = await Shipment.findByIdAndUpdate(
            req.params.id,
            { status },
            {
                new: true,
                runValidators: true
            }
        );

        if (!shipment) {
            return res.status(404).json({
                message: "Không tìm thấy đơn giao hàng"
            });
        }

        res.status(200).json({
            message: "Cập nhật trạng thái giao hàng thành công",
            shipment
        });
    } catch (error) {
        console.error("Update shipment status error:", error.message);

        res.status(500).json({
            message: "Lỗi khi cập nhật trạng thái giao hàng"
        });
    }
});
// Lấy danh sách giao hàng
app.get("/shipments", async (req, res) => {
    try {
        const shipments = await Shipment.find().sort({ createdAt: -1 });

        res.status(200).json({
            count: shipments.length,
            shipments
        });
    } catch (error) {
        console.error("Get shipments error:", error.message);

        res.status(500).json({
            message: "Lỗi khi lấy danh sách giao hàng"
        });
    }
});

// Khởi động sau khi kết nối MongoDB
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");

        const PORT = process.env.PORT || 3006;

        app.listen(PORT, () => {
            console.log(`Shipment Service running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
