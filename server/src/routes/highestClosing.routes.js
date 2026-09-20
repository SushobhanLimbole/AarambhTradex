import express from "express";
import { getHighestClosingReport } from "../controllers/highestClosing.controller.js";

const router = express.Router();

/**
 * GET /api/highest-closing
 * GET /api/highest-closing/scan
 */
router.get("/", getHighestClosingReport);
router.get("/scan", getHighestClosingReport);

export default router;
