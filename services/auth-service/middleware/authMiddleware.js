
const jwt = require("jsonwebtoken");
const path = require("path");

// Nạp đúng file .env của Auth Service
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

// Xác thực JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Vui lòng cung cấp JWT token"
        });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            message: "JWT token bị thiếu"
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            console.error("JWT verification failed:", error.message);

            return res.status(401).json({
                message: "Token không hợp lệ hoặc đã hết hạn"
            });
        }

        req.user = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role
        };

        next();
    });
}

module.exports = authenticateToken;
