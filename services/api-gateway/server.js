
const express = require("express");
require("dotenv").config();

const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3002;

// Trang chủ API Gateway
app.get("/", (req, res) => {
    res.status(200).send("Ecommerce API Gateway is running!");
});

// Kiểm tra sức khỏe API Gateway
app.get("/health", (req, res) => {
    res.status(200).json({
        service: "api-gateway",
        status: "healthy"
    });
});

// Chuyển tiếp yêu cầu đến Auth Service
app.use(
    createProxyMiddleware({
        pathFilter: (path) => path.startsWith("/auth"),
        target: process.env.AUTH_SERVICE_URL || "http://localhost:3003",
        changeOrigin: true
    })
);

// Chuyển tiếp yêu cầu đến Customer Service
app.use(
    createProxyMiddleware({
        pathFilter: (path) => path.startsWith("/customers"),
        target: process.env.CUSTOMER_SERVICE_URL || "http://localhost:3004",
        changeOrigin: true
    })
);

// Chuyển tiếp yêu cầu đến Product Service
app.use(
    createProxyMiddleware({
        pathFilter: (path) => path.startsWith("/products"),
        target: process.env.PRODUCT_SERVICE_URL || "http://localhost:3005",
        changeOrigin: true
    })
);

// Chuyển tiếp yêu cầu đến Order Service
app.use(
    createProxyMiddleware({
        pathFilter: (path) => path.startsWith("/orders"),
        target: process.env.ORDER_SERVICE_URL || "http://localhost:3007",
        changeOrigin: true
    })
);

// Chuyển tiếp yêu cầu đến Shipment Service
app.use(
    createProxyMiddleware({
        pathFilter: (path) => path.startsWith("/shipments"),
        target: process.env.SHIPMENT_SERVICE_URL || "http://localhost:3006",
        changeOrigin: true
    })
);

// Khởi động API Gateway
app.listen(PORT, "0.0.0.0", () => {
    console.log(`API Gateway running on port ${PORT}`);
});
