import { Router } from "express";
import {
  getSymbols,
  getAllStocksByTimeframe,
  getLatestStocksAll,
  getStockDataByTimeframe,
  getStockDataById,
  createStockData,
  bulkCreateStockData,
  updateStockData,
  updateMultipleStocks,
  deleteStockData,
  deleteStockDataBySymbol,
  deleteAllStocks,
} from "../controllers/stockData.controller.js";

const router = Router();

// 26042.3008 - close tf - 1 - rec: 1

/* =========================================================================
   1. NON-SYMBOL-SPECIFIC APIS (AFFECTS ALL STOCKS)
   ========================================================================= */

// Get all stocks resampled by timeframe (supports ?timeframe=Weekly&limit=all&symbols=NIFTY,RELIANCE)
router.get("/", getAllStocksByTimeframe);
router.get("/all", getAllStocksByTimeframe);

// Get latest candle per symbol for a timeframe (e.g. ?timeframe=Daily)
router.get("/latest", getLatestStocksAll);

// Get distinct list of symbols
router.get("/symbols", getSymbols);

// Bulk insert / upsert across symbols
router.post("/bulk", bulkCreateStockData);

// Update records across multiple symbols by criteria (startDate, endDate, symbols)
router.put("/", updateMultipleStocks);
router.patch("/", updateMultipleStocks);

// Delete records across multiple symbols by criteria or wipe all
router.delete("/", deleteAllStocks);

/* =========================================================================
   2. SINGLE RECORD ID OPERATIONS
   ========================================================================= */

router.get("/record/:id", getStockDataById);
router.put("/record/:id", updateStockData);
router.delete("/record/:id", deleteStockData);

/* =========================================================================
   3. SYMBOL-SPECIFIC APIS
   ========================================================================= */

// Symbol timeframe retrieval (supports ?timeframe=Monthly&limit=all)
router.get("/:symbol", getStockDataByTimeframe);

// Delete all records or date range for a specific symbol
router.delete("/symbol/:symbol", deleteStockDataBySymbol);

// Create single record
router.post("/", createStockData);

export default router;
