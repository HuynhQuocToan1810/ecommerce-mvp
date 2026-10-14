
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authenticateToken = require("./middleware/authMiddleware");
const authorizeRoles = require("./middleware/authorizeRoles");
require("dotenv").config();

const pool = require("./db");

const app = express();
app.use(express.json());

// Trang chủ Auth Service
app.get("/", (req, res) => {
    res.send("Ecommerce Auth Service is running!");
});

// Kiểm tra trạng thái Auth Service và PostgreSQL
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            service: "auth-service",
            status: "healthy",
            database: "connected"
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);

        res.status(503).json({
            service: "auth-service",
            status: "unhealthy",
            database: "disconnected"
        });
    }
});

// Đăng ký tài khoản
app.post("/auth/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email và password là bắt buộc"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (password.length < 8) {
            return res.status(400).json({
                message: "Mật khẩu phải có ít nhất 8 ký tự"
            });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email đã được đăng ký"
            });
        }

        // Mã hóa mật khẩu trước khi lưu
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             RETURNING id, email, created_at`,
            [normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            message: "Đăng ký thành công",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Register error:", error.message);

        // Xử lý trường hợp email trùng do hai yêu cầu đồng thời
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Email đã được đăng ký"
            });
        }

        return res.status(500).json({
            message: "Lỗi máy chủ khi đăng ký"
        });
    }
});

// Đăng nhập
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email và password là bắt buộc"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Tìm tài khoản theo email
        const result = await pool.query(
            `SELECT id, email, password_hash, role
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không chính xác"
            });
        }

        const user = result.rows[0];

        // So sánh mật khẩu với mật khẩu đã mã hóa
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không chính xác"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET chưa được cấu hình");
        }

        // Tạo JWT có thời hạn 1 giờ
        const token = jwt.sign(
            {
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                subject: String(user.id),
                expiresIn: "1h"
            }
        );
        return res.status(200).json({
            message: "Đăng nhập thành công",
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Lỗi máy chủ khi đăng nhập"
        });
    }
});
// API chỉ dành cho admin
app.get(
    "/auth/admin",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        res.status(200).json({
            message: "Chào mừng admin",
            user: req.user
        });
    }
);
// Khởi động server
const PORT = process.env.PORT || 3003;

app.get("/auth/me", authenticateToken, (req, res) => {
    res.status(200).json({
        message: "Xác thực thành công",
        user: req.user
    });
});

app.listen(PORT, () => {
    console.log(`Auth Service running at http://localhost:${PORT}`);
});
