import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";
import { calculateStrategyData } from "../services/strategyFormula.service.js";

/**
 * Controller for New Trend Report (Trend Scanner)
 * Computes:
 * - Current Trend (UP-TREND / DOWN-TREND) based on HLC HIGHER / LOWER
 * - Trend Date (When current trend was established)
 * - Monthly Pointer (Previous Month's Pointer Type, e.g., for Sep 2026 record, August 2026 pointer)
 * - YGR Comparison (Comparison of monthly timeframe Y, G, R levels against today's closing price)
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
 * Map monthly pointer scenario to corresponding Y, G, R trigger codes and levels
 */
function getYgrTriggersForScenario(scenario, triggers) {
  const norm = String(scenario || "").trim().toUpperCase();
  const yList = triggers?.yellow || {};
  const gList = triggers?.green || {};
  const rList = triggers?.red || {};

  let yCode = "Y1", yVal = yList.Y1;
  let gCode = "G1", gVal = gList.G1;
  let rCode = "R1", rVal = rList.R1;

  if (norm === "TABLE TENNIS") {
    yCode = "Y2"; yVal = yList.Y2;
    gCode = "G2"; gVal = gList.G2;
    rCode = "R2"; rVal = rList.R2;
  } else if (norm === "BUYING POINTER" || norm === "RISING JACK") {
    yCode = "Y3"; yVal = yList.Y3;
    gCode = "G3"; gVal = gList.G3;
    rCode = "R3"; rVal = rList.R3;
  } else if (norm === "TABLE TOP" || norm.includes("TABLE TOP")) {
    yCode = "Y4"; yVal = yList.Y4 || yList.Y1;
    gCode = "G2"; gVal = gList.G2;
    rCode = "R4"; rVal = rList.R4 || rList.R1;
  } else if (norm === "SELLING POINTER" || norm === "FALLING DUCK" || norm === "UPWARD ROTATION") {
    yCode = "Y1"; yVal = yList.Y1;
    gCode = "G1"; gVal = gList.G1;
    rCode = "R1"; rVal = rList.R1;
  } else if (norm.includes("BREAKOUT")) {
    yCode = "Y5"; yVal = yList.Y5 || yList.Y1;
    gCode = "G2"; gVal = gList.G2;
    rCode = "R5"; rVal = rList.R5 || rList.R1;
  } else {
    // Default fallback
    yCode = "Y1"; yVal = yList.Y1;
    gCode = "G1"; gVal = gList.G1;
    rCode = "R1"; rVal = rList.R1;
  }

  return [
    { trigger: yCode, triggerPrice: Number(yVal) || 0, colorKey: "yellow" },
    { trigger: gCode, triggerPrice: Number(gVal) || 0, colorKey: "green" },
    { trigger: rCode, triggerPrice: Number(rVal) || 0, colorKey: "red" },
  ];
}

/**
 * Evaluates HLC trend sequence on an array of ascending candles
 */
function evaluateTrendSequence(candles) {
  if (!candles || candles.length === 0) {
    return {
      trend: "—",
      trendDate: "—",
      rawTrendDate: null,
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

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve date ceiling
    let targetDate = actionDate;
    if (!targetDate) {
      const [maxRes] = await pool.query(`SELECT MAX(\`date\`) as maxDate FROM \`${tableName}\``);
      targetDate = maxRes[0]?.maxDate;
    }
    const targetDateStr = targetDate ? (typeof targetDate === "string" ? targetDate.slice(0, 10) : new Date(targetDate).toISOString().slice(0, 10)) : null;

    // 2. Fetch distinct symbols matching exchange & index
    const symbolRows = await getFilteredSymbols({ exchange, indice });

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
    const symbolExchangeMap = new Map();
    symbolRows.forEach((r) => {
      symbolExchangeMap.set(r.symbol, r.exchange || exchange || "NSE");
    });

    // 3. Query historical records for matched symbols (up to past 400 days to calculate trend & monthly pointer)
    const placeholders = matchedSymbols.map(() => "?").join(",");
    let dateCondition = "";
    const queryParams = [...matchedSymbols];

    if (targetDateStr) {
      dateCondition = "AND `date` >= DATE_SUB(?, INTERVAL 400 DAY) AND `date` <= ?";
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

      const lastDaily = symDaily[symDaily.length - 1];
      const lastDailyClose = Number(lastDaily.close) || 0;
      const lastDateStr = typeof lastDaily.date === "string" ? lastDaily.date.slice(0, 10) : new Date(lastDaily.date).toISOString().slice(0, 10);

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

      // Filter for ADV / SET #2 mode if requested
      if (mode === "set2" && currEval.trend !== htfEval.trend && !currEval.power) {
        continue;
      }

      // -------------------------------------------------------------
      // Calculate Pointer & YGR Comparison for Current Timeframe Candle
      // -------------------------------------------------------------
      const targetCandle = currEval.lastCandle || currCandles[currCandles.length - 1] || lastDaily;
      const candleClose = Number(targetCandle.close) || lastDailyClose;
      const candleDate = targetCandle.date || targetCandle.endDate || lastDaily.date;

      let pointer = "—";
      let pointerDate = "—";
      let ygr = [];

      if (targetCandle) {
        const strategyData = calculateStrategyData(targetCandle);
        const scenario = strategyData.conditions?.scenario;
        if (scenario && scenario !== "FALSE") {
          pointer = scenario;
        }
        pointerDate = formatDateOutput(candleDate);

        // Calculate YGR comparison against today's closing price
        const ygrTriggers = getYgrTriggersForScenario(pointer, strategyData.triggers);
        ygr = ygrTriggers.map((t) => {
          const triggerPrice = Number(t.triggerPrice) || 0;
          const diffPct = triggerPrice > 0
            ? Number((((candleClose - triggerPrice) / triggerPrice) * 100).toFixed(2))
            : 0;
          return {
            trigger: t.trigger,
            triggerPrice,
            diffPct,
            colorKey: t.colorKey,
          };
        });
      }

      results.push({
        symbol: sym,
        exchange: symbolExchangeMap.get(sym) || exchange || "NSE",
        currTrend: currEval.trend,
        trendDate: currEval.trendDate,
        rawTrendDate: currEval.rawTrendDate,
        pointer,
        pointerDate,
        monthlyPointer: pointer,
        monthlyPointerDate: pointerDate,
        ygr,
        area: currEval.area,
        slot: currEval.slot,
        power: currEval.power,
        htrLtr: htrLtrStr,
        htfTrend: htfEval.trend,
        htfTrendDate: htfEval.trendDate,
        rawHtfTrendDate: htfEval.rawTrendDate,
        htfArea: htfEval.area,
        price: candleClose,
      });
    }

    // Default Sorting: Filter stocks by date, ordering newest first
    results.sort((a, b) => {
      const timeA = a.rawTrendDate ? new Date(a.rawTrendDate).getTime() : 0;
      const timeB = b.rawTrendDate ? new Date(b.rawTrendDate).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA; // Newest first
      }
      return a.symbol.localeCompare(b.symbol);
    });

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
