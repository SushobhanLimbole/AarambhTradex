import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";

/**
 * Controller for New Trend Report (Trend Scanner)
 * Computes:
 * - Current Trend (UP-TREND / DOWN-TREND) based on HLC HIGHER / LOWER
 * - Trend Date (When current trend was established)
 * - Area (GREEN / RED)
 * - Slot (HIGHER / LOWER)
 * - Power (HIGH / LOW)
 * - HTR / LTR (Higher Trend Reference / Lower Trend Reference)
 * - HTF Trend (Higher Timeframe Trend: UP-TREND / DOWN-TREND)
 * - HTF Trend Date
 * - HTF Area (GREEN / RED)
 */

const getNextHigherTimeframe = (tf) => {
  const norm = String(tf || "Daily").trim().toLowerCase();
  if (norm === "daily") return "Weekly";
  if (norm === "weekly") return "Monthly";
  if (norm === "monthly") return "Quarterly";
  if (norm === "quarterly") return "Yearly";
  if (norm === "yearly") return "5-Yearly";
  return "Weekly";
};

const formatDateOutput = (dStr) => {
  if (!dStr) return "—";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return String(dStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(dStr);
  }
};

/**
 * Evaluates HLC trend sequence on an array of ascending candles
 */
function evaluateTrendSequence(candles) {
  if (!candles || candles.length === 0) {
    return {
      trend: "—",
      trendDate: "—",
      area: "",
      slot: "",
      power: "",
      htr: null,
      ltr: null,
      lastCandle: null,
      prevCandle: null,
    };
  }

  let currentTrend = "UP-TREND"; // default initial
  let trendDate = candles[0].date;
  let htrLevel = null;
  let ltrLevel = null;

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const cHigh = Number(curr.high) || 0;
    const cLow = Number(curr.low) || 0;
    const cClose = Number(curr.close) || 0;

    const pHigh = Number(prev.high) || 0;
    const pLow = Number(prev.low) || 0;
    const pClose = Number(prev.close) || 0;

    // HLC HIGHER: High > Prev High && Low > Prev Low && Close > Prev Close && Close > Prev High
    const isHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;

    // HLC LOWER: High < Prev High && Low < Prev Low && Close < Prev Close && Close < Prev Low
    const isHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

    if (isHlcHigher) {
      if (currentTrend !== "UP-TREND") {
        currentTrend = "UP-TREND";
        trendDate = curr.date;
      }
      htrLevel = cHigh;
    } else if (isHlcLower) {
      if (currentTrend !== "DOWN-TREND") {
        currentTrend = "DOWN-TREND";
        trendDate = curr.date;
      }
      ltrLevel = cLow;
    } else {
      if (cHigh > (htrLevel || 0)) htrLevel = cHigh;
      if (ltrLevel === null || (cLow > 0 && cLow < ltrLevel)) ltrLevel = cLow;
    }
  }

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;

  let area = "";
  let slot = "";
  let power = "";

  if (lastCandle && prevCandle) {
    const lClose = Number(lastCandle.close) || 0;
    const lHigh = Number(lastCandle.high) || 0;
    const lLow = Number(lastCandle.low) || 0;

    const pClose = Number(prevCandle.close) || 0;
    const pHigh = Number(prevCandle.high) || 0;
    const pLow = Number(prevCandle.low) || 0;
    const pAvg = (pHigh + pLow + pClose) / 3;

    // Area: GREEN if Close > Prev Close & Close > Prev Avg | RED if Close < Prev Close & Close < Prev Avg
    if (lClose > pClose && lClose > pAvg) {
      area = "GREEN";
    } else if (lClose < pClose && lClose < pAvg) {
      area = "RED";
    }

    // Slot: HIGHER if Low > Prev Avg | LOWER if High < Prev Avg
    if (lLow > pAvg) {
      slot = "HIGHER";
    } else if (lHigh < pAvg) {
      slot = "LOWER";
    }

    // Power: Range expansion > 14.6% or strong upper/lower close
    const range = Math.max(0, lHigh - lLow);
    const prevRange = Math.max(0, pHigh - pLow);
    if (range > prevRange * 1.146 || lClose > pHigh) {
      power = "HIGH";
    } else if (lClose < pLow || (range > prevRange && area === "RED")) {
      power = "LOW";
    }
  }

  return {
    trend: currentTrend,
    trendDate: formatDateOutput(trendDate),
    rawTrendDate: trendDate,
    area,
    slot,
    power,
    htr: htrLevel,
    ltr: ltrLevel,
    lastCandle,
    prevCandle,
  };
}

/**
 * Format HTR / LTR string like "HTR- 2861.72" or "LTR- 273.32" or "HTR- 1916.1 LTR- 1899.5"
 */
function formatHtrLtr(htr, ltr, trend) {
  if (htr && ltr) {
    return `HTR- ${Number(htr).toFixed(2)} LTR- ${Number(ltr).toFixed(2)}`;
  }
  if (htr && (trend === "UP-TREND" || !ltr)) {
    return `HTR- ${Number(htr).toFixed(2)}`;
  }
  if (ltr) {
    return `LTR- ${Number(ltr).toFixed(2)}`;
  }
  return "—";
}

/**
 * GET /api/trend-report
 * Run the New Trend Scanner across stocks
 */
export const getNewTrendReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      mode = "set1", // 'set1' (All / RUN) or 'set2' (Advanced / ADV)
      limit = "all",
    } = req.query;

    const tableName = process.env.MYSQL_HISTORICAL_TABLE || process.env.MYSQL_STOCK_TABLE || "historical_candles";

    // 1. Resolve date ceiling
    let targetDate = actionDate;
    if (!targetDate) {
      const [maxRes] = await pool.query(`SELECT MAX(\`date\`) as maxDate FROM \`${tableName}\``);
      targetDate = maxRes[0]?.maxDate;
    }
    const targetDateStr = targetDate ? (typeof targetDate === "string" ? targetDate.slice(0, 10) : new Date(targetDate).toISOString().slice(0, 10)) : null;

    // 2. Fetch distinct symbols matching exchange & index
    let symQuery = `SELECT DISTINCT \`symbol\`, \`exchange\`, \`indice\` FROM \`${tableName}\` WHERE \`symbol\` IS NOT NULL`;
    const symParams = [];

    if (exchange && String(exchange).toUpperCase() !== "ALL") {
      symQuery += " AND `exchange` = ?";
      symParams.push(exchange);
    }
    if (indice && String(indice).toUpperCase() !== "ALL") {
      const cleanIdx = String(indice).trim();
      if (cleanIdx.toUpperCase() === "TOP 500") {
        // Limit query by ordering by volume/id or no indice restriction
      } else {
        symQuery += " AND (LOWER(`indice`) = LOWER(?) OR LOWER(`indice`) LIKE LOWER(?))";
        symParams.push(cleanIdx, `%${cleanIdx}%`);
      }
    }

    symQuery += " ORDER BY `symbol` ASC";
    const [symbolRows] = await pool.query(symQuery, symParams);

    if (!symbolRows || symbolRows.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        actionDate: targetDateStr,
        timeframe,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);

    // 3. Query historical records for matched symbols (up to past 365 days to calculate trend)
    const placeholders = matchedSymbols.map(() => "?").join(",");
    let dateCondition = "";
    const queryParams = [...matchedSymbols];

    if (targetDateStr) {
      dateCondition = "AND `date` >= DATE_SUB(?, INTERVAL 365 DAY) AND `date` <= ?";
      queryParams.push(targetDateStr, targetDateStr);
    }

    const candlesQuery = `
      SELECT \`id\`, \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
      FROM \`${tableName}\`
      WHERE \`symbol\` IN (${placeholders})
      ${dateCondition}
      ORDER BY \`symbol\` ASC, \`date\` ASC
    `;

    const [allCandleRows] = await pool.query(candlesQuery, queryParams);

    // Group rows by symbol
    const candlesBySymbol = new Map();
    for (const row of allCandleRows) {
      if (!candlesBySymbol.has(row.symbol)) {
        candlesBySymbol.set(row.symbol, []);
      }
      candlesBySymbol.get(row.symbol).push(row);
    }

    const htfTimeframe = getNextHigherTimeframe(timeframe);
    const results = [];

    for (const sym of matchedSymbols) {
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 2) continue;

      // Resample for Current Timeframe
      let currCandles = symDaily;
      if (String(timeframe).toLowerCase() !== "daily") {
        currCandles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      // Resample for Higher Timeframe (HTF)
      const htfCandles = StockDataModel.resampleCandles(symDaily, htfTimeframe);

      if (currCandles.length < 2) continue;

      // Evaluate Current Timeframe Trend Sequence
      const currEval = evaluateTrendSequence(currCandles);

      // Evaluate Higher Timeframe (HTF) Trend Sequence
      const htfEval = evaluateTrendSequence(htfCandles);

      const htrLtrStr = formatHtrLtr(currEval.htr, currEval.ltr, currEval.trend);

      // Filter for ADV / SET #2 mode if requested (e.g. only stocks where Curr Trend matches HTF Trend or high power)
      if (mode === "set2" && currEval.trend !== htfEval.trend && !currEval.power) {
        continue;
      }

      results.push({
        symbol: sym,
        currTrend: currEval.trend,
        trendDate: currEval.trendDate,
        rawTrendDate: currEval.rawTrendDate,
        area: currEval.area,
        slot: currEval.slot,
        power: currEval.power,
        htrLtr: htrLtrStr,
        htfTrend: htfEval.trend,
        htfTrendDate: htfEval.trendDate,
        rawHtfTrendDate: htfEval.rawTrendDate,
        htfArea: htfEval.area,
        price: currEval.lastCandle ? Number(currEval.lastCandle.close) : null,
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      actionDate: formatDateOutput(targetDateStr),
      rawActionDate: targetDateStr,
      timeframe,
      higherTimeframe: htfTimeframe,
      mode,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};
