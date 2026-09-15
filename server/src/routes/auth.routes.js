import express from "express";
import { signup, signin, getProfile } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public auth routes
router.post("/signup", signup);
router.post("/signin", signin);

// Protected auth route
router.get("/me", verifyJWT, getProfile);

export default router;
