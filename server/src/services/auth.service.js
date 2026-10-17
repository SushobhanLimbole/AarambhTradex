import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

/**
 * Generate JWT Token for user
 */
export const generateToken = (user) => {
    const payload = {
        id: user._id,
        email: user.email,
        isAdmin: user.isAdmin,
        hasAccess: user.hasAccess
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    });
};

/**
 * Verify JWT Token
 */
export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Register a new user
 */
export const registerUser = async ({ name, email, password, isAdmin = false }) => {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        const error = new Error("User with this email already exists");
        error.statusCode = 400;
        throw error;
    }

    // Enforce "only one admin" rule:
    // If requested to create an admin, check if any admin already exists in the system.
    let makeAdmin = Boolean(isAdmin);
    if (makeAdmin) {
        const existingAdmin = await User.findOne({ isAdmin: true });
        if (existingAdmin) {
            const error = new Error("An admin already exists in the system. Only one admin is allowed.");
            error.statusCode = 400;
            throw error;
        }
    }

    const user = new User({
        name,
        email: email.toLowerCase(),
        password,
        isAdmin: makeAdmin,
        hasAccess: false
    });

    await user.save();

    const token = generateToken(user);
    return { user, token };
};

/**
 * Login existing user
 */
export const loginUser = async ({ email, password }) => {
    if (!email || !password) {
        const error = new Error("Email and password are required");
        error.statusCode = 400;
        throw error;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    const token = generateToken(user);
    return { user, token };
};

/**
 * Get user profile by ID
 */
export const getUserById = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }
    return user;
};

/**
 * Admin creates a user
 */
export const createUserByAdmin = async ({ name, email, password, hasAccess = false }) => {
    if (!name || !email || !password) {
        const error = new Error("Name, email, and password are required");
        error.statusCode = 400;
        throw error;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        const error = new Error("User with this email already exists");
        error.statusCode = 400;
        throw error;
    }

    const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        isAdmin: false,
        hasAccess: Boolean(hasAccess)
    });

    await user.save();
    return user;
};

/**
 * Get all users for admin
 */
export const getAllUsers = async () => {
    const users = await User.find();
    return users.map((u) => u.toJSON());
};

/**
 * Delete a user by ID
 */
export const deleteUserById = async (userId) => {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    if (targetUser.isAdmin) {
        const error = new Error("Admin accounts cannot be deleted");
        error.statusCode = 400;
        throw error;
    }

    const deleted = await User.deleteById(userId);
    return deleted;
};

/**
 * Reset password for a specific user (admin action)
 */
export const resetUserPassword = async (userId, newPassword) => {
    if (!newPassword || newPassword.length < 6) {
        const error = new Error("Password must be at least 6 characters long");
        error.statusCode = 400;
        throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    user.password = newPassword;
    await user.save();
    return user.toJSON();
};

/**
 * Change password for currently authenticated user
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
    if (!newPassword || newPassword.length < 6) {
        const error = new Error("New password must be at least 6 characters long");
        error.statusCode = 400;
        throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    if (currentPassword) {
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            const error = new Error("Current password is incorrect");
            error.statusCode = 400;
            throw error;
        }
    }

    user.password = newPassword;
    await user.save();
    return user.toJSON();
};


