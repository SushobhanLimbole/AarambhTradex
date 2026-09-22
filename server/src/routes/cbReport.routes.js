import express from "express";
import { getCbReport } from "../controllers/cbReport.controller.js";

const router = express.Router();

/**
 * GET /api/cb-report
 * GET /api/cb-report/scan
 */
router.get("/", getCbReport);
router.get("/scan", getCbReport);

export default router;
