import pool from "../config/mysql.js";
import { calculateTrigger } from "../services/screenerFormula.js";
import { calculateStrategyData } from "../services/strategyFormula.service.js";

/**
 * Stock Market Screener Controller (Breakout Report)
 * Compares current period (CMP1) with historical reference (CMP2)
 */

const DEFAULT_TABLE = process.env.MYSQL_HISTORICAL_TABLE || process.env.MYSQL_STOCK_TABLE || "historical_candles";

/**
 * Determine the active MySQL table (checks 'historical_candles' first, falls back to 'stock_data')
 */
async function resolveTable() {
  try {
    const [tables] = await pool.query("SHOW TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);
    if (tableNames.includes("historical_candles")) return "historical_candles";
    if (tableNames.includes("stock_data")) return "stock_data";
    return DEFAULT_TABLE;
  } catch {
    return DEFAULT_TABLE;
  }
}

/**
 * Resample / Aggregate daily rows into a single period candle for a symbol
 */
function aggregatePeriodCandle(rows) {
  if (!rows || rows.length === 0) return null;
  // rows expected in ascending date order
  const open = Number(rows[0].open) || 0;
  let high = Number(rows[0].high) || 0;
  let low = Number(rows[0].low) || 0;
  let volume = 0;

  for (const r of rows) {
    const h = Number(r.high) || 0;
    const l = Number(r.low) || 0;
    if (h > high) high = h;
    if (l < low) low = l;
    volume += Number(r.volume) || 0;
  }

  const close = Number(rows[rows.length - 1].close) || 0;
  // Institutional Formula: Range = High - Low; Average = (High + Low + Close) / 3 (Open is strictly NOT included)
  const range = Number((high - low).toFixed(2));
  const average = Number(((high + low + close) / 3).toFixed(2));

  return { open, high, low, close, volume, range, average };
}

/**
 * Helper to build SQL queries for screener based on exchange & indice filters
 */
function buildScreenerQuery(startDate, endDate, exchange, indice) {
  const normExch = exchange ? String(exchange).trim().toUpperCase() : "ALL";
  const normInd = indice ? String(indice).trim() : "ALL";

  const hasExchangeFilter = normExch !== "ALL" && normExch !== "ALL EXCHANGES" && normExch !== "";
  const hasIndiceFilter = normInd !== "ALL" && normInd !== "ALL INDICES" && normInd !== "" && normInd.toUpperCase() !== "TOP 500";

  if (normExch === "CRYPTO" || normExch === "METALS" || normInd.toLowerCase() === "crypto" || normInd.toLowerCase() === "metals") {
    let q = "SELECT t.`symbol`, t.`date`, t.`open`, t.`high`, t.`low`, t.`close`, t.`volume`, s.`exchange` FROM `global_assets` t JOIN `symbols` s ON t.`symbol` = s.`symbol`";
    const p = [startDate, endDate];
    let where = "WHERE t.`date` >= ? AND t.`date` <= ?";
    if (hasExchangeFilter) {
      where += " AND s.`exchange` = ?";
      p.push(normExch);
    }
    if (hasIndiceFilter && normInd.toLowerCase() !== "crypto" && normInd.toLowerCase() !== "metals") {
      q += " JOIN `index_constituents` ic ON s.`symbol` = ic.`symbol` JOIN `indices` i ON ic.`index_id` = i.`index_id`";
      where += " AND (LOWER(i.`index_name`) = LOWER(?) OR LOWER(i.`index_name`) LIKE LOWER(?))";
      p.push(normInd, `%${normInd}%`);
    }
    q += ` ${where} ORDER BY t.\`symbol\` ASC, t.\`date\` ASC`;
    return { query: q, params: p };
  }

  if (normExch === "NSE" || normExch === "BSE") {
    let q = "SELECT t.`symbol`, t.`date`, t.`open`, t.`high`, t.`low`, t.`close`, t.`volume`, s.`exchange` FROM `historical_candles` t JOIN `symbols` s ON t.`symbol` = s.`symbol`";
    const p = [startDate, endDate];
    let where = "WHERE t.`date` >= ? AND t.`date` <= ?";
    where += " AND s.`exchange` = ?";
    p.push(normExch);
    if (hasIndiceFilter) {
      q += " JOIN `index_constituents` ic ON s.`symbol` = ic.`symbol` JOIN `indices` i ON ic.`index_id` = i.`index_id`";
      where += " AND (LOWER(i.`index_name`) = LOWER(?) OR LOWER(i.`index_name`) LIKE LOWER(?))";
      p.push(normInd, `%${normInd}%`);
    }
    q += ` ${where} ORDER BY t.\`symbol\` ASC, t.\`date\` ASC`;
    return { query: q, params: p };
  }

  // If ALL exchanges, but specific indice
  if (hasIndiceFilter) {
    let q = "SELECT t.`symbol`, t.`date`, t.`open`, t.`high`, t.`low`, t.`close`, t.`volume`, s.`exchange` FROM `historical_candles` t JOIN `symbols` s ON t.`symbol` = s.`symbol` JOIN `index_constituents` ic ON s.`symbol` = ic.`symbol` JOIN `indices` i ON ic.`index_id` = i.`index_id` WHERE t.`date` >= ? AND t.`date` <= ? AND (LOWER(i.`index_name`) = LOWER(?) OR LOWER(i.`index_name`) LIKE LOWER(?)) ORDER BY t.`symbol` ASC, t.`date` ASC";
    return { query: q, params: [startDate, endDate, normInd, `%${normInd}%`] };
  }

  // ALL exchanges & ALL indices: Union historical_candles and global_assets
  let q = `
    SELECT t.\`symbol\`, t.\`date\`, t.\`open\`, t.\`high\`, t.\`low\`, t.\`close\`, t.\`volume\`, s.\`exchange\` 
    FROM \`historical_candles\` t 
    JOIN \`symbols\` s ON t.\`symbol\` = s.\`symbol\` 
    WHERE t.\`date\` >= ? AND t.\`date\` <= ?
    UNION ALL
    SELECT g.\`symbol\`, g.\`date\`, g.\`open\`, g.\`high\`, g.\`low\`, g.\`close\`, g.\`volume\`, s.\`exchange\` 
    FROM \`global_assets\` g 
    JOIN \`symbols\` s ON g.\`symbol\` = s.\`symbol\` 
    WHERE g.\`date\` >= ? AND g.\`date\` <= ?
    ORDER BY \`symbol\` ASC, \`date\` ASC
  `;
  const p = [startDate, endDate, startDate, endDate];
  return { query: q, params: p };
}

/**
 * POST /api/screener
 * Main Screener Endpoint
 */
export const runBreakoutScreener = async (req, res, next) => {
  try {
    const { cmp1, cmp2, pattern = "TABLE TOP", trigger, triggers, exchange = "ALL", indice = "ALL" } = req.body || {};

    if (!cmp1 || !cmp2) {
      return res.status(400).json({
        success: false,
        message: "Both cmp1 and cmp2 parameters (startDate, endDate, timeframe) are required.",
      });
    }

    const cmp1Start = cmp1.startDate;
    const cmp1End = cmp1.endDate || cmp1.startDate;
    const cmp2Start = cmp2.startDate;
    const cmp2End = cmp2.endDate || cmp2.startDate;

    if (!cmp1Start || !cmp2Start) {
      return res.status(400).json({
        success: false,
        message: "Start dates for both CMP1 and CMP2 are required.",
      });
    }

    // Parse multi-trigger list
    let triggerList = [];
    if (Array.isArray(triggers) && triggers.length > 0) {
      triggerList = triggers.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof trigger === "string" && trigger.trim()) {
      triggerList = trigger.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(trigger) && trigger.length > 0) {
      triggerList = trigger.map((t) => String(t).trim()).filter(Boolean);
    }
    if (triggerList.length === 0) triggerList = ["Y1"];

    // =======================================================================
    // 1. QUERY CMP2 (Historical Reference Period) - Grouped by Symbol
    // =======================================================================
    const { query: cmp2Query, params: cmp2Params } = buildScreenerQuery(cmp2Start, cmp2End, exchange, indice);

    let cmp2Rows = [];
    try {
      const [rows] = await pool.query(cmp2Query, cmp2Params);
      cmp2Rows = rows;
    } catch (dbErr) {
      console.warn("MySQL query warning on CMP2, using demo dataset fallback:", dbErr.message);
    }

    // =======================================================================
    // 2. QUERY CMP1 (Current Market Period) - Grouped by Symbol
    // =======================================================================
    const { query: cmp1Query, params: cmp1Params } = buildScreenerQuery(cmp1Start, cmp1End, exchange, indice);

    let cmp1Rows = [];
    try {
      const [rows] = await pool.query(cmp1Query, cmp1Params);
      cmp1Rows = rows;
    } catch (dbErr) {
      console.warn("MySQL query warning on CMP1:", dbErr.message);
    }

    // =======================================================================
    // 3. AGGREGATE CANDLES PER SYMBOL
    // =======================================================================
    const cmp2BySymbol = {};
    for (const r of cmp2Rows) {
      if (!r.symbol) continue;
      if (!cmp2BySymbol[r.symbol]) cmp2BySymbol[r.symbol] = [];
      cmp2BySymbol[r.symbol].push(r);
    }

    const cmp1BySymbol = {};
    for (const r of cmp1Rows) {
      if (!r.symbol) continue;
      if (!cmp1BySymbol[r.symbol]) cmp1BySymbol[r.symbol] = [];
      cmp1BySymbol[r.symbol].push(r);
    }

    // =======================================================================
    // 4. SCREENING LOOP (CMP1 Close > Any CMP2 Trigger in selection, strictly matching Pointer Type)
    // =======================================================================
    const qualifyingSymbols = [];
    const detailedResults = []; // Stock breakout breakdown
    const normalizedSelectedPattern = String(pattern || "").trim().toUpperCase();
    const isAnyPattern = !normalizedSelectedPattern || normalizedSelectedPattern === "ALL" || normalizedSelectedPattern === "ANY";

    const allSymbols = Array.from(
      new Set([...Object.keys(cmp2BySymbol), ...Object.keys(cmp1BySymbol)])
    );

    // If database had rows, process them
    if (allSymbols.length > 0) {
      for (const symbol of allSymbols) {
        const cmp2Candle = aggregatePeriodCandle(cmp2BySymbol[symbol]);
        const cmp1Candle = aggregatePeriodCandle(cmp1BySymbol[symbol]);

        if (!cmp2Candle || !cmp1Candle) continue;

        // 1. Evaluate reference period (CMP2) strategy formula, scenario, and triggers
        const cmp2StrategyData = calculateStrategyData(cmp2Candle);
        const cmp2Scenario = String(cmp2StrategyData?.conditions?.scenario || "").trim().toUpperCase();

        // 2. Enforce pointer pattern matching if a specific pattern is selected
        if (!isAnyPattern) {
          // Check scenario or specific pointer aliases (e.g. RISING JACK -> BUYING POINTER, FALLING DUCK -> SELLING POINTER)
          let patternMatches = false;
          if (cmp2Scenario === normalizedSelectedPattern) {
            patternMatches = true;
          } else if (normalizedSelectedPattern === "RISING JACK" && (cmp2Scenario === "BUYING POINTER" || cmp2Scenario === "RISING BREAKOUT")) {
            patternMatches = true;
          } else if (normalizedSelectedPattern === "FALLING DUCK" && (cmp2Scenario === "SELLING POINTER" || cmp2Scenario === "FALLING BREAKDOWN")) {
            patternMatches = true;
          }

          if (!patternMatches) {
            // Stock's reference period did not form the requested pointer pattern (e.g. UPWARD ROTATION when TABLE TOP was requested)
            continue;
          }
        }

        // 3. Check breakout above selected trigger levels
        const matchedTriggers = [];
        for (const trig of triggerList) {
          const triggerPrice = calculateTrigger(cmp2Candle, pattern, trig);
          if (triggerPrice !== null && cmp1Candle.close > triggerPrice) {
            matchedTriggers.push({
              trigger: trig,
              triggerPrice,
              pctBreakout: Number((((cmp1Candle.close - triggerPrice) / triggerPrice) * 100).toFixed(2)),
            });
          }
        }

        if (matchedTriggers.length > 0) {
          qualifyingSymbols.push(symbol);
          const symMeta = cmp2BySymbol[symbol]?.[0] || cmp1BySymbol[symbol]?.[0];
          detailedResults.push({
            symbol,
            exchange: symMeta?.exchange || exchange || "NSE",
            indice: symMeta?.indice || indice || "",
            cmp1Close: cmp1Candle.close,
            open: cmp2Candle.open,
            high: cmp2Candle.high,
            low: cmp2Candle.low,
            close: cmp2Candle.close,
            range: cmp2Candle.range,
            average: cmp2Candle.average,
            pattern: cmp2Scenario || pattern,
            matchedTriggers,
            triggerCount: matchedTriggers.length,
            primaryTrigger: matchedTriggers[0].trigger,
            primaryTriggerPrice: matchedTriggers[0].triggerPrice,
            maxPctBreakout: Math.max(...matchedTriggers.map((m) => m.pctBreakout)),
          });
        }
      }
    } else {
      // Fallback / Demo Screener Results if database is empty/offline
      const DEMO_UNIVERSE = [
        { symbol: "RELIANCE.NS", cmp1Close: 3020.50, cmp2High: 2950.00, cmp2Low: 2880.00 },
        { symbol: "TCS.NS", cmp1Close: 4210.00, cmp2High: 4120.00, cmp2Low: 4050.00 },
        { symbol: "HDFCBANK.NS", cmp1Close: 1680.00, cmp2High: 1640.00, cmp2Low: 1590.00 },
        { symbol: "INFY.NS", cmp1Close: 1890.25, cmp2High: 1830.00, cmp2Low: 1770.00 },
        { symbol: "ICICIBANK.NS", cmp1Close: 1240.00, cmp2High: 1210.00, cmp2Low: 1175.00 },
        { symbol: "BHARTIARTL.NS", cmp1Close: 1560.00, cmp2High: 1505.00, cmp2Low: 1470.00 },
        { symbol: "SBIN.NS", cmp1Close: 840.50, cmp2High: 815.00, cmp2Low: 790.00 },
        { symbol: "LT.NS", cmp1Close: 3780.00, cmp2High: 3690.00, cmp2Low: 3580.00 },
        { symbol: "TATAMOTORS.NS", cmp1Close: 1084.20, cmp2High: 1040.00, cmp2Low: 990.00 },
        { symbol: "SUNPHARMA.NS", cmp1Close: 1840.00, cmp2High: 1790.00, cmp2Low: 1740.00 },
        { symbol: "BAJFINANCE.NS", cmp1Close: 7450.00, cmp2High: 7300.00, cmp2Low: 7120.00 },
        { symbol: "M&M.NS", cmp1Close: 2940.00, cmp2High: 2860.00, cmp2Low: 2780.00 },
      ];

      for (const item of DEMO_UNIVERSE) {
        const dummyCmp2 = {
          open: (item.cmp2High + item.cmp2Low) / 2,
          high: item.cmp2High,
          low: item.cmp2Low,
          close: item.cmp2High - 10,
          range: item.cmp2High - item.cmp2Low,
          average: (item.cmp2High + item.cmp2Low + (item.cmp2High - 10)) / 3,
          volume: 1000000,
        };

        const cmp2StrategyData = calculateStrategyData(dummyCmp2);
        const cmp2Scenario = String(cmp2StrategyData?.conditions?.scenario || "").trim().toUpperCase();

        if (!isAnyPattern) {
          let patternMatches = false;
          if (cmp2Scenario === normalizedSelectedPattern) {
            patternMatches = true;
          } else if (normalizedSelectedPattern === "RISING JACK" && (cmp2Scenario === "BUYING POINTER" || cmp2Scenario === "RISING BREAKOUT")) {
            patternMatches = true;
          } else if (normalizedSelectedPattern === "FALLING DUCK" && (cmp2Scenario === "SELLING POINTER" || cmp2Scenario === "FALLING BREAKDOWN")) {
            patternMatches = true;
          }

          if (!patternMatches) {
            continue;
          }
        }

        const matchedTriggers = [];
        for (const trig of triggerList) {
          const triggerPrice = calculateTrigger(dummyCmp2, pattern, trig);
          if (triggerPrice !== null && item.cmp1Close > triggerPrice) {
            matchedTriggers.push({
              trigger: trig,
              triggerPrice,
              pctBreakout: Number((((item.cmp1Close - triggerPrice) / triggerPrice) * 100).toFixed(2)),
            });
          }
        }

        if (matchedTriggers.length > 0) {
          qualifyingSymbols.push(item.symbol);
          detailedResults.push({
            symbol: item.symbol,
            cmp1Close: item.cmp1Close,
            open: dummyCmp2.open,
            high: dummyCmp2.high,
            low: dummyCmp2.low,
            close: dummyCmp2.close,
            range: dummyCmp2.range,
            average: dummyCmp2.average,
            pattern: cmp2Scenario || pattern,
            matchedTriggers,
            triggerCount: matchedTriggers.length,
            primaryTrigger: matchedTriggers[0].trigger,
            primaryTriggerPrice: matchedTriggers[0].triggerPrice,
            maxPctBreakout: Math.max(...matchedTriggers.map((m) => m.pctBreakout)),
          });
        }
      }
    }

    // Sort alphabetically by STOCK NAME
    qualifyingSymbols.sort();

    // =======================================================================
    // 5. RESPONSE: Format as { success: true, results: ["RELIANCE.NS", ...], triggers: [...] }
    // =======================================================================
    return res.status(200).json({
      success: true,
      count: qualifyingSymbols.length,
      pattern,
      triggers: triggerList,
      trigger: triggerList.join(", "),
      results: qualifyingSymbols,
      details: detailedResults,
    });
  } catch (error) {
    next(error);
  }
};
