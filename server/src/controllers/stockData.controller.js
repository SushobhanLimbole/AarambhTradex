import StockDataModel from "../models/stockData.model.js";

/**
 * Controller for Stock Data CRUD and Timeframe Retrieval
 * (Both Symbol-Specific and Non-Symbol-Specific across all stocks)
 */

const VALID_TIMEFRAMES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Yearly",
  "5-Yearly",
];

const parseTimeframe = (tf) => {
  if (!tf) return "Daily";
  return (
    VALID_TIMEFRAMES.find(
      (t) => t.toLowerCase() === String(tf).trim().toLowerCase()
    ) || "Daily"
  );
};

/* =========================================================================
   1. NON-SYMBOL-SPECIFIC RETRIEVAL APIS (ALL STOCKS)
   ========================================================================= */

/**
 * GET /api/stocks or GET /api/stocks/all
 * Retrieve stock data across ALL symbols with timeframe resampling
 * 
 * Query parameters:
 * - timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
 * - symbols: comma-separated list of symbols (e.g. 'NIFTY,BANKNIFTY,RELIANCE')
 * - startDate: 'YYYY-MM-DD'
 * - endDate: 'YYYY-MM-DD'
 * - limit: number or 'all' (fetches all rows without limit)
 * - order: 'ASC' | 'DESC'
 */
export const getAllStocksByTimeframe = async (req, res, next) => {
  try {
    const {
      timeframe = "Daily",
      symbols,
      exchange,
      indice,
      startDate,
      endDate,
      limit = 1000,
      order = "ASC",
    } = req.query;

    const matchedTf = parseTimeframe(timeframe);

    const data = await StockDataModel.findAllByTimeframe(matchedTf, {
      symbols,
      exchange,
      indice,
      startDate,
      endDate,
      limit: limit === "all" || limit === "ALL" ? "all" : limit,
      order: String(order).toUpperCase() === "DESC" ? "DESC" : "ASC",
    });

    return res.status(200).json({
      success: true,
      timeframe: matchedTf,
      limit: limit === "all" || limit === "ALL" ? "all" : Number(limit),
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks/latest
 * Retrieve the latest candle for every symbol in the database
 * Query parameters: timeframe
 */
export const getLatestStocksAll = async (req, res, next) => {
  try {
    const { timeframe = "Daily", date } = req.query;
    const matchedTf = parseTimeframe(timeframe);

    const data = await StockDataModel.getLatestAllSymbols(matchedTf, { date });

    return res.status(200).json({
      success: true,
      timeframe: matchedTf,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks/symbols
 * Retrieve all unique symbols present in the database
 */
export const getSymbols = async (req, res, next) => {
  try {
    const symbols = await StockDataModel.getAllSymbols();
    return res.status(200).json({
      success: true,
      count: symbols.length,
      data: symbols,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   2. SYMBOL-SPECIFIC RETRIEVAL APIS
   ========================================================================= */

/**
 * GET /api/stocks/:symbol
 * Retrieve stock data for a specific symbol with timeframe resampling
 * 
 * Query parameters:
 * - timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
 * - startDate: 'YYYY-MM-DD'
 * - endDate: 'YYYY-MM-DD'
 * - limit: number or 'all' (fetches all rows without limit)
 * - order: 'ASC' | 'DESC'
 */
export const getStockDataByTimeframe = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const {
      timeframe = "Daily",
      exchange,
      startDate,
      endDate,
      limit = 500,
      order = "ASC",
    } = req.query;

    const matchedTf = parseTimeframe(timeframe);

    const data = await StockDataModel.findByTimeframe(symbol, matchedTf, {
      exchange,
      startDate,
      endDate,
      limit: limit === "all" || limit === "ALL" ? "all" : limit,
      order: String(order).toUpperCase() === "DESC" ? "DESC" : "ASC",
    });

    return res.status(200).json({
      success: true,
      symbol,
      timeframe: matchedTf,
      limit: limit === "all" || limit === "ALL" ? "all" : Number(limit),
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks/record/:id
 * Retrieve a single record by primary key ID
 */
export const getStockDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await StockDataModel.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: `Stock record with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   3. CREATE APIS (SINGLE & BULK)
   ========================================================================= */

/**
 * POST /api/stocks
 * Create a single stock price record
 * Body: { symbol, date, open, high, low, close, volume }
 */
export const createStockData = async (req, res, next) => {
  try {
    const { symbol, date, open, high, low, close, volume } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date field is required (YYYY-MM-DD)",
      });
    }

    const newRecord = await StockDataModel.create({
      symbol,
      date,
      open,
      high,
      low,
      close,
      volume,
    });

    return res.status(201).json({
      success: true,
      message: "Stock data created successfully",
      data: newRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stocks/bulk
 * Bulk insert or upsert multiple stock records across any symbols
 * Body: { records: [ { symbol, date, open, high, low, close, volume }, ... ], updateOnDuplicate: true }
 */
export const bulkCreateStockData = async (req, res, next) => {
  try {
    const { records, updateOnDuplicate = true } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body must include a non-empty 'records' array",
      });
    }

    const result = await StockDataModel.bulkCreate(records, { updateOnDuplicate });

    return res.status(201).json({
      success: true,
      message: `Bulk operation completed successfully. Inserted/Updated: ${result.affectedRows}`,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   4. UPDATE APIS (BY ID, BY SYMBOL & DATE, OR MULTI-STOCK CRITERIA)
   ========================================================================= */

/**
 * PUT /api/stocks/record/:id
 * Update a single stock record by ID
 */
export const updateStockData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await StockDataModel.updateById(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Stock record with ID ${id} not found or no changes made`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock data updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/stocks or PATCH /api/stocks
 * Update stock records across multiple stocks by criteria (Non-symbol specific)
 * Body: { criteria: { symbols, startDate, endDate }, updateData: { open, high, low, close, volume } }
 */
export const updateMultipleStocks = async (req, res, next) => {
  try {
    const { criteria = {}, updateData = {} } = req.body;

    const affectedRows = await StockDataModel.updateAll(criteria, updateData);

    return res.status(200).json({
      success: true,
      message: `Updated ${affectedRows} stock records successfully`,
      affectedRows,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   5. DELETE APIS (BY ID, BY SYMBOL, OR MULTI-STOCK CRITERIA)
   ========================================================================= */

/**
 * DELETE /api/stocks/record/:id
 * Delete a single stock record by ID
 */
export const deleteStockData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await StockDataModel.deleteById(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Stock record with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Stock record with ID ${id} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/stocks/symbol/:symbol
 * Delete all records or date-ranged records for a specific symbol
 */
export const deleteStockDataBySymbol = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate } = req.query;

    let deletedRows;
    if (startDate && endDate) {
      deletedRows = await StockDataModel.deleteBySymbolAndDateRange(symbol, startDate, endDate);
    } else {
      deletedRows = await StockDataModel.deleteBySymbol(symbol);
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedRows} records for symbol '${symbol}'`,
      affectedRows: deletedRows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/stocks
 * Delete stock records across ALL stocks matching criteria or delete all (Non-symbol specific)
 * Query or Body: { symbols, startDate, endDate }
 */
export const deleteAllStocks = async (req, res, next) => {
  try {
    const criteria = {
      symbols: req.query.symbols || req.body?.symbols,
      startDate: req.query.startDate || req.body?.startDate,
      endDate: req.query.endDate || req.body?.endDate,
    };

    const deletedRows = await StockDataModel.deleteAll(criteria);

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedRows} stock records matching criteria`,
      affectedRows: deletedRows,
    });
  } catch (error) {
    next(error);
  }
};
