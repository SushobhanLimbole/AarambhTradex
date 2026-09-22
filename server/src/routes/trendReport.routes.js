import express from "express";
import { getNewTrendReport } from "../controllers/trendReport.controller.js";

const router = express.Router();

/**
 * GET /api/trend-report
 * Query New Trend Report (Trend Scanner)
 */
router.get("/", getNewTrendReport);
router.get("/scan", getNewTrendReport);

export default router;
