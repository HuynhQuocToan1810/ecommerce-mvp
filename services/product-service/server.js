
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());

// Schema sản phẩm
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    category: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

const Product = mongoose.model("Product", productSchema);

// Kiểm tra sức khỏe service và MongoDB
app.get("/health", async (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;

    res.status(databaseConnected ? 200 : 503).json({
        service: "product-service",
        status: databaseConnected ? "healthy" : "unhealthy",
        database: databaseConnected ? "connected" : "disconnected"
    });
});
// Thêm sản phẩm mới
app.post("/products", async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;

        const product = await Product.create({
            name,
            description,
            price,
            stock,
            category
        });

        res.status(201).json({
            message: "Thêm sản phẩm thành công",
            product
        });
    } catch (error) {
        console.error("Create product error:", error.message);

        res.status(400).json({
            message: "Không thể thêm sản phẩm",
            error: error.message
        });
    }
});
// Lấy danh sách sản phẩm
app.get("/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });

        res.status(200).json({
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Get products error:", error.message);

        res.status(500).json({
            message: "Lỗi khi lấy danh sách sản phẩm"
        });
    }
});
// Cập nhật sản phẩm
app.put("/products/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "ID sản phẩm không hợp lệ"
            });
        }

        const { name, description, price, stock, category } = req.body;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, stock, category },
            {
                new: true,
                runValidators: true,
                omitUndefined: true
            }
        );

        if (!product) {
            return res.status(404).json({
                message: "Không tìm thấy sản phẩm"
            });
        }

        res.status(200).json({
            message: "Cập nhật sản phẩm thành công",
            product
        });
    } catch (error) {
        console.error("Update product error:", error.message);

        res.status(400).json({
            message: "Không thể cập nhật sản phẩm",
            error: error.message
        });
    }
});
// Lấy chi tiết sản phẩm theo ID
app.get("/products/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "ID sản phẩm không hợp lệ"
            });
        }

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                message: "Không tìm thấy sản phẩm"
            });
        }

        res.status(200).json({ product });
    } catch (error) {
        console.error("Get product error:", error.message);

        res.status(500).json({
            message: "Lỗi khi lấy chi tiết sản phẩm"
        });
    }
});
// Xóa sản phẩm
app.delete("/products/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "ID sản phẩm không hợp lệ"
            });
        }

        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                message: "Không tìm thấy sản phẩm"
            });
        }

        res.status(200).json({
            message: "Xóa sản phẩm thành công",
            product
        });
    } catch (error) {
        console.error("Delete product error:", error.message);

        res.status(500).json({
            message: "Lỗi khi xóa sản phẩm"
        });
    }
});
// Khởi động server sau khi kết nối MongoDB
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");

        const PORT = process.env.PORT || 3005;

        app.listen(PORT, () => {
            console.log(`Product Service running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
