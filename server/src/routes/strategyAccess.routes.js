import express from "express";
import {
    requestAccess,
    getMyStatus,
    getAllRequests,
    handleRequestReview
} from "../controllers/strategyAccess.controller.js";
import { verifyJWT, requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Authenticated user routes
router.post("/request", verifyJWT, requestAccess);
router.get("/status", verifyJWT, getMyStatus);

// Admin-only routes
router.get("/requests", verifyJWT, requireAdmin, getAllRequests);
router.patch("/requests/:requestId", verifyJWT, requireAdmin, handleRequestReview);
router.post("/requests/:requestId/review", verifyJWT, requireAdmin, handleRequestReview);

export default router;
