
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Bạn chưa xác thực"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Bạn không có quyền truy cập"
            });
        }

        next();
    };
}

module.exports = authorizeRoles;
