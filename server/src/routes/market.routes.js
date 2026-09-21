import { Router } from "express";
import { getLiveQuotes } from "../controllers/market.controller.js";

const router = Router();

// GET /api/market/live-quotes
router.get("/live-quotes", getLiveQuotes);

export default router;
