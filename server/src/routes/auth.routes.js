import express from "express";
import {
  signup,
  signin,
  getProfile,
  adminCreateUser,
  adminGetUsers,
  adminDeleteUser,
} from "../controllers/auth.controller.js";
import { verifyJWT, requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public auth routes
router.post("/signup", signup);
router.post("/register", signup);
router.post("/signin", signin);
router.post("/login", signin);

// Protected auth route
router.get("/me", verifyJWT, getProfile);

// Admin-only User Management routes
router.post("/admin/create-user", verifyJWT, requireAdmin, adminCreateUser);
router.get("/admin/users", verifyJWT, requireAdmin, adminGetUsers);
router.delete("/admin/users/:id", verifyJWT, requireAdmin, adminDeleteUser);

export default router;

