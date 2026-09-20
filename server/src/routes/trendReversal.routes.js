import express from "express";
import { getTrendReversalReport } from "../controllers/trendReversal.controller.js";

const router = express.Router();

/**
 * GET /api/trend-reversal
 * GET /api/trend-reversal/scan
 */
router.get("/", getTrendReversalReport);
router.get("/scan", getTrendReversalReport);

export default router;
