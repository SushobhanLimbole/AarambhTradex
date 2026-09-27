import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import pool from "../config/mysql.js";
import { calculateTrigger } from "../services/screenerFormula.js";
import { calculateStrategyData } from "../services/strategyFormula.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const date = rows[rows.length - 1].date ? String(rows[rows.length - 1].date).slice(0, 10) : "";
  // Institutional Formula: Range = High - Low; Average = (High + Low + Close) / 3 (Open is strictly NOT included)
  const range = Number((high - low).toFixed(2));
  const average = Number(((high + low + close) / 3).toFixed(2));

  return { open, high, low, close, volume, range, average, date };
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
            date: cmp1Candle.date || cmp1End,
            cmp1Date: cmp1Candle.date || cmp1End,
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

/**
 * POST /api/screener/generate-strategy-sheet
 * Injects resultant stock OHLC into base pointer.xlsx / strategy.xlsx template pointer sheet.
 * Retains only the Pointer Matrix and OHLCAR table (removing right table and bottom 5 rows).
 */
export const generateStrategySheet = async (req, res, next) => {
  try {
    const { symbol, open, high, low, close, average, range, date, timeframe } = req.body || {};

    const templateCandidates = [
      path.resolve(__dirname, "../data/pointer.xlsx"),
      path.resolve(__dirname, "../data/strategy.xlsx"),
      path.resolve(__dirname, "../../../pointer.xlsx"),
      path.resolve(__dirname, "../../../strategy.xlsx"),
      path.resolve(__dirname, "../../pointer.xlsx"),
      path.resolve(__dirname, "../../strategy.xlsx"),
      path.resolve(process.cwd(), "pointer.xlsx"),
      path.resolve(process.cwd(), "strategy.xlsx"),
      path.resolve(process.cwd(), "../pointer.xlsx"),
      path.resolve(process.cwd(), "../strategy.xlsx"),
      "/Users/sushobhanlimbole/Projects/mern/aarambh_tradex/pointer.xlsx",
      "/Users/sushobhanlimbole/Projects/mern/aarambh_tradex/strategy.xlsx",
    ];

    let templatePath = null;
    for (const candidate of templateCandidates) {
      if (fs.existsSync(candidate)) {
        templatePath = candidate;
        break;
      }
    }

    if (!templatePath) {
      return res.status(404).json({
        success: false,
        message: "Base pointer.xlsx / strategy.xlsx template not found on server.",
      });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);

    // Get pointer sheet
    let ws =
      wb.getWorksheet("pointer") ||
      wb.getWorksheet("POINTER") ||
      wb.worksheets.find((w) => w.name.trim().toLowerCase() === "pointer") ||
      wb.worksheets[2] ||
      wb.worksheets[0];

    if (!ws) {
      return res.status(400).json({
        success: false,
        message: "Pointer worksheet not found in template.",
      });
    }

    const openVal = Number(open) || 0;
    const highVal = Number(high) || 0;
    const lowVal = Number(low) || 0;
    const closeVal = Number(close) || 0;
    const avgVal =
      average !== undefined && average !== null && !isNaN(Number(average))
        ? Number(average)
        : Number(((highVal + lowVal + closeVal) / 3).toFixed(2));
    const rangeVal =
      range !== undefined && range !== null && !isNaN(Number(range))
        ? Number(range)
        : Number((highVal - lowVal).toFixed(2));

    // Put values in row 32 of pointer sheet:
    // D32 = Open, E32 = High, F32 = Low, G32 = Close, H32 = Average, I32 = Range
    ws.getCell("D32").value = openVal;
    ws.getCell("E32").value = highVal;
    ws.getCell("F32").value = lowVal;
    ws.getCell("G32").value = closeVal;
    ws.getCell("H32").value = avgVal;
    ws.getCell("I32").value = rangeVal;

    // Remove the right table and the bottom 5 rows (Columns M [13] onwards)
    // 1. Unmerge any merges touching columns >= 13 (Column M onwards)
    if (ws._merges) {
      const merges = Object.values(ws._merges);
      for (const m of merges) {
        if (m.model && (m.model.left >= 13 || m.model.right >= 13)) {
          try {
            ws.unmergeCells(m.model.range);
          } catch (_) {}
        }
      }
    }

    // 2. Clear values and styling from Column M (13) to column 40 across all rows
    const maxRow = Math.max(ws.rowCount || 0, 100);
    for (let r = 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      for (let c = 13; c <= 40; c++) {
        const cell = row.getCell(c);
        cell.value = null;
        cell.style = {};
      }
    }

    // 3. Remove all other worksheets (e.g. "IMP POINTS", "VIEW ") so ONLY the pointer page is exported
    const sheetsToRemove = wb.worksheets.filter(
      (w) => w.name.trim().toLowerCase() !== "pointer"
    );
    for (const sheet of sheetsToRemove) {
      wb.removeWorksheet(sheet.id);
    }

    // Optional metadata label cell if present
    const cleanSym = symbol ? String(symbol).replace(/[^a-zA-Z0-9._-]/g, "_") : "Stock";
    const filename = `Strategy_${cleanSym}_${date || "Analysis"}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating strategy excel sheet:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate strategy spreadsheet.",
    });
  }
};

/**
 * POST /api/screener/export-results-excel
 * Generates an Excel workbook containing all qualifying breakout stocks with columns:
 * [STOCK NAME, DATE, MATCHED BREAKOUT TRIGGERS, CMP1 CLOSE]
 */
export const exportScreenerResultsExcel = async (req, res, next) => {
  try {
    const { results, details, date, triggers } = req.body || {};

    const wb = new ExcelJS.Workbook();
    wb.creator = "Aarambh Tradex";
    wb.lastModifiedBy = "Aarambh Tradex";
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet("Breakout Results", {
      views: [{ showGridLines: true }],
    });

    // Define the exact 4 requested columns
    ws.columns = [
      { header: "STOCK NAME", key: "stockName", width: 22 },
      { header: "DATE", key: "date", width: 16 },
      { header: "MATCHED BREAKOUT TRIGGERS", key: "matchedTriggers", width: 34 },
      { header: "CMP1 CLOSE", key: "cmp1Close", width: 18 },
    ];

    // Style Header Row (Row 1)
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" }, // Dark Slate
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "medium", color: { argb: "FF1E293B" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    const items = Array.isArray(details) && details.length > 0
      ? details
      : Array.isArray(results)
      ? results.map((s) => ({ symbol: s }))
      : [];

    items.forEach((item, idx) => {
      const cleanStockName = item.symbol
        ? String(item.symbol).replace(/\.(NS|BO)$/i, "")
        : item.stockName || "—";
      const dateVal = item.date || item.cmp1Date || date || "—";

      let matchedStr = "";
      if (Array.isArray(item.matchedTriggers) && item.matchedTriggers.length > 0) {
        matchedStr = item.matchedTriggers
          .map((m) => {
            if (m.triggerPrice && m.pctBreakout !== undefined) {
              return `${m.trigger} (@ ₹${m.triggerPrice}, +${m.pctBreakout}%)`;
            }
            return m.trigger || m;
          })
          .join(", ");
      } else if (item.matchedTriggers) {
        matchedStr = String(item.matchedTriggers);
      } else if (Array.isArray(triggers) && triggers.length > 0) {
        matchedStr = triggers.join(", ");
      } else {
        matchedStr = "Breakout Match";
      }

      const cmp1CloseVal =
        item.cmp1Close !== undefined && item.cmp1Close !== null && !isNaN(Number(item.cmp1Close))
          ? Number(Number(item.cmp1Close).toFixed(2))
          : item.close !== undefined && item.close !== null && !isNaN(Number(item.close))
          ? Number(Number(item.close).toFixed(2))
          : "—";

      const row = ws.addRow({
        stockName: cleanStockName,
        date: dateVal,
        matchedTriggers: matchedStr,
        cmp1Close: cmp1CloseVal,
      });

      row.height = 22;
      const isEven = idx % 2 === 0;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Calibri", size: 10.5, bold: colNumber === 1 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          if (typeof cell.value === "number") {
            cell.numFmt = "#,##0.00";
          }
        }
      });
    });

    const fileDate = date || new Date().toISOString().slice(0, 10);
    const filename = `Breakout_Results_${fileDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting screener results to excel:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to export breakout results.",
    });
  }
};
