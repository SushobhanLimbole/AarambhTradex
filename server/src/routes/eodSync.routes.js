import express from "express";
import {
  triggerIndianSync,
  triggerGlobalSync,
  triggerReconciliation,
  getSyncStatus,
} from "../controllers/eodSync.controller.js";

const router = express.Router();

// Public / Administrative sync endpoints
router.post("/indian", triggerIndianSync);
router.post("/global", triggerGlobalSync);
router.post("/reconcile", triggerReconciliation);
router.get("/status", getSyncStatus);

export default router;
