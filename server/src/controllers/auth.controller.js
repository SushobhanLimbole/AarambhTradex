import * as authService from "../services/auth.service.js";

/**
 * Handle User Signup
 */
export const signup = async (req, res, next) => {
    try {
        const { name, email, password, isAdmin } = req.body;

        if (!name || !email || !password) {
            const error = new Error("Name, email, and password are required");
            error.statusCode = 400;
            throw error;
        }

        const { user, token } = await authService.registerUser({
            name,
            email,
            password,
            isAdmin
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user,
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Handle User Signin
 */
export const signin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const { user, token } = await authService.loginUser({ email, password });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            message: "Signed in successfully",
            data: {
                user,
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Current Authenticated User Profile
 */
export const getProfile = async (req, res, next) => {
    try {
        return res.status(200).json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        next(error);
    }
};
