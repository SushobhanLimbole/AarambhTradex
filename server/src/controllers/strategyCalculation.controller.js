import { calculateStrategyData } from "../services/strategyFormula.service.js";
import pool from "../config/mysql.js";

/**
 * Controller for Confidential Strategy Decision Engine Calculations
 * Exclusively for Admin / Approved Users with hasAccess
 */

export const calculateStrategy = async (req, res, next) => {
  try {
    // Check Authorization: User must be authenticated and have strategy access (or be admin)
    if (req.user) {
      if (!req.user.isAdmin && !req.user.hasAccess) {
        return res.status(403).json({
          success: false,
          hasAccess: false,
          message: "Strategy Access Required: Your account does not have permission to view institutional strategy formulas. Please submit an access request.",
        });
      }
    }

    const { open, high, low, close, symbol, date, timeframe, range, average } = req.body || {};

    let candle = {
      open: parseFloat(open) || 0,
      high: parseFloat(high) || 0,
      low: parseFloat(low) || 0,
      close: parseFloat(close) || 0,
      range: (range !== undefined && range !== null && !isNaN(parseFloat(range))) ? parseFloat(range) : undefined,
      average: (average !== undefined && average !== null && !isNaN(parseFloat(average))) ? parseFloat(average) : undefined,
    };

    // If OHLC not directly provided or 0, but symbol and date are passed, query from MySQL
    if ((!candle.open && !candle.high && !candle.close) && symbol) {
      try {
        const sym = String(symbol).trim();
        let [rows] = await pool.query(
          "SELECT open, high, low, close FROM historical_candles WHERE symbol = ? ORDER BY date DESC LIMIT 1",
          [sym]
        );
        if (!rows || rows.length === 0) {
          [rows] = await pool.query(
            "SELECT open, high, low, close FROM global_assets WHERE symbol = ? ORDER BY date DESC LIMIT 1",
            [sym]
          );
        }
        if (rows && rows.length > 0) {
          candle = {
            open: parseFloat(rows[0].open) || 0,
            high: parseFloat(rows[0].high) || 0,
            low: parseFloat(rows[0].low) || 0,
            close: parseFloat(rows[0].close) || 0,
          };
        }
      } catch (dbErr) {
        console.warn("Could not load candle from DB for strategy calculation:", dbErr.message);
      }
    }

    // Perform confidential proprietary calculations
    const strategyData = calculateStrategyData(candle);

    return res.status(200).json({
      success: true,
      hasAccess: true,
      symbol: symbol || "CUSTOM",
      timeframe: timeframe || "Daily",
      ...strategyData,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  calculateStrategy,
};
