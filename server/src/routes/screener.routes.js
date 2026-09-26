import { Router } from "express";
import { runBreakoutScreener, generateStrategySheet } from "../controllers/screener.controller.js";

const router = Router();

/**
 * POST /api/screener
 * Breakout Screener calculation comparing CMP1 vs CMP2 trigger level
 */
router.post("/", runBreakoutScreener);

/**
 * POST /api/screener/generate-strategy-sheet
 * Injects stock OHLC values into strategy.xlsx pointer sheet and downloads xlsx
 */
router.post("/generate-strategy-sheet", generateStrategySheet);
router.post("/export-strategy-excel", generateStrategySheet);

export default router;
