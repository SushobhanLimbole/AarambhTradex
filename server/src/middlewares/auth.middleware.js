import { verifyToken, getUserById } from "../services/auth.service.js";

/**
 * Authentication Middleware: Verify JWT and attach user object to request
 */
export const verifyJWT = async (req, res, next) => {
    try {
        let token = null;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers["x-access-token"]) {
            token = req.headers["x-access-token"];
        }

        if (!token) {
            const error = new Error("Authentication token missing or invalid");
            error.statusCode = 401;
            throw error;
        }

        const decoded = verifyToken(token);
        const user = await getUserById(decoded.id);

        if (!user) {
            const error = new Error("User not found or account deactivated");
            error.statusCode = 401;
            throw error;
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Authorization Middleware: Enforce admin access
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        const error = new Error("Forbidden: Access restricted to Admin only");
        error.statusCode = 403;
        return next(error);
    }
    next();
};
