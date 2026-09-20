import express from "express";
import { getAbTopBottomReport } from "../controllers/abTopBottom.controller.js";

const router = express.Router();

/**
 * GET /api/ab-top-bottom
 * GET /api/ab-top-bottom/scan
 */
router.get("/", getAbTopBottomReport);
router.get("/scan", getAbTopBottomReport);

export default router;
