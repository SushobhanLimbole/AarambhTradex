import express from "express";
import { getPointerReport } from "../controllers/pointerReport.controller.js";
import { verifyJWT as requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @route   GET /api/reports/pointer-report
 * @desc    Fetch institutional pointer report across daily, weekly, monthly, yearly, 5-yearly
 * @access  Private (Authenticated users)
 */
router.get("/", getPointerReport);
router.get("/scan", getPointerReport);
router.post("/", getPointerReport);
router.post("/scan", getPointerReport);

export default router;
