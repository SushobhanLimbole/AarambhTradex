import { Router } from "express";
import { getDdReport } from "../controllers/ddReport.controller.js";

const router = Router();

router.get("/", getDdReport);

export default router;
