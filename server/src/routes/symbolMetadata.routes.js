import express from "express";
import {
  getSymbolsMeta,
  getAllSymbols,
  getSymbolById,
  createSymbol,
  updateSymbol,
  deleteSymbol,
} from "../controllers/symbolMetadata.controller.js";

const router = express.Router();

/**
 * Symbol Metadata Endpoints
 * 
 * GET    /api/symbols/meta  -> High-speed summary of distinct exchanges & indices
 * GET    /api/symbols       -> List / Filter symbols by exchange, indice, search
 * GET    /api/symbols/:id   -> Get symbol by ID or ticker symbol string
 * POST   /api/symbols       -> Create a new symbol record
 * PUT    /api/symbols/:id   -> Update a symbol record by ID
 * DELETE /api/symbols/:id   -> Delete a symbol record by ID
 */
router.get("/meta", getSymbolsMeta);
router.get("/", getAllSymbols);
router.get("/:id", getSymbolById);
router.post("/", createSymbol);
router.put("/:id", updateSymbol);
router.delete("/:id", deleteSymbol);

export default router;
