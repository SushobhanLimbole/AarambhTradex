/**
 * 404 Not Found Middleware
 * Handles requests to undefined routes
 */
export const notFoundHandler = (req, res, next) => {
    const error = new Error(`Resource not found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

/**
 * Global Error Handling Middleware
 * Catches all errors passed to next(error) or thrown in async handlers
 */
export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Handle Mongoose Invalid ObjectId (CastError)
    if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // Handle Mongoose Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue || {})[0] || "field";
        message = `Duplicate value entered for '${field}'. Please use another value.`;
    }

    // Handle Mongoose Validation Error
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((val) => val.message)
            .join(", ");
    }

    // Handle JWT Invalid Token Error
    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid authentication token";
    }

    // Handle JWT Expired Token Error
    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Authentication token expired";
    }

    // Log unexpected 500 errors in development/server console
    if (statusCode === 500) {
        console.error("Unhandled Error:", err);
    }

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};
