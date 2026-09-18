import { Router } from "express";
import { runBreakoutScreener } from "../controllers/screener.controller.js";

const router = Router();

/**
 * POST /api/screener
 * Breakout Screener calculation comparing CMP1 vs CMP2 trigger level
 */
router.post("/", runBreakoutScreener);

export default router;
