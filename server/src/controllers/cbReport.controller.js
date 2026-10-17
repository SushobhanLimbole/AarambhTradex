import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * CB (CLOSING BREAKOUT) & CB WITH STATUS CONTROLLER
 * Formulations matching specification:
 * 
 * 1. BULLISH (GREEN):
 *    - TYPE 1: ORDINARY CB:
 *        DAY 1: CLOSE > SAME DAY AVG
 *        DAY 2: CLOSE > PREV.HIGH
 *    - TYPE 2: CB WITH STATUS:
 *        DAY 1: CLOSE > SAME DAY AVG
 *        DAY 2: CLOSE > PREV.HIGH + ON DAY 2 HLC HIGHER FORMED (High2 > High1 & Low2 > Low1 & Close2 > Close1 & Close2 > High1)
 * 
 * 2. BEARISH (RED):
 *    - TYPE 1: ORDINARY CB:
 *        DAY 1: CLOSE < SAME DAY AVG
 *        DAY 2: CLOSE < PREV.LOW
 *    - TYPE 2: CB WITH STATUS:
 *        DAY 1: CLOSE < SAME DAY AVG
 *        DAY 2: CLOSE < PREV.LOW + ON DAY 2 HLC LOWER FORMED (High2 < High1 & Low2 < Low1 & Close2 < Close1 & Close2 < Low1)
 * 
 * 3. FOR ALL TIMEFRAMES:
 *    - Supports Daily, Weekly, Monthly, Quarterly, Half-Yearly, Yearly
 */

// In-memory cache for high-volume comparative study queries (TTL: 3 minutes)
const responseCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;

// Cached max date to avoid 5s partition table scans
let cachedMaxDate = null;
const MAX_DATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
 * Evaluate HLC Higher & HLC Lower for two consecutive candles
 */
function checkHlcHigher(curr, prev) {
  if (!curr || !prev) return false;
  const cHigh = Number(curr.high) || 0;
  const cLow = Number(curr.low) || 0;
  const cClose = Number(curr.close) || 0;
  const pHigh = Number(prev.high) || 0;
  const pLow = Number(prev.low) || 0;
  const pClose = Number(prev.close) || 0;
  return cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
}

function checkHlcLower(curr, prev) {
  if (!curr || !prev) return false;
  const cHigh = Number(curr.high) || 0;
  const cLow = Number(curr.low) || 0;
  const cClose = Number(curr.close) || 0;
  const pHigh = Number(prev.high) || 0;
  const pLow = Number(prev.low) || 0;
  const pClose = Number(prev.close) || 0;
  return cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;
}

/**
 * Evaluates CB status at index `currIdx` in the candles array
 * 
 * Rules:
 * 1. Bullish CB (Day 1: Close > Avg, Day 2: Close > Prev High)
 *    - Ordinary Bullish CB: HLC HIGHER occurred FIRST (prior to this CB).
 *    - Advanced Bullish CB: CB formed, and on its NEXT DAY HLC HIGHER is compulsory formed.
 * 
 * 2. Bearish CB (Day 1: Close < Avg, Day 2: Close < Prev Low)
 *    - Ordinary Bearish CB: HLC LOWER occurred FIRST (prior to this CB).
 *    - Advanced Bearish CB: CB formed, and on its NEXT DAY HLC LOWER is compulsory formed.
 */
function evaluateCbAtIndex(candles, currIdx) {
  if (!candles || currIdx < 1 || currIdx >= candles.length) return null;

  const currCandle = candles[currIdx];
  const prevCandle = candles[currIdx - 1];

  const pHigh = Number(prevCandle.high) || 0;
  const pLow = Number(prevCandle.low) || 0;
  const pClose = Number(prevCandle.close) || 0;
  const pAvg = (pHigh + pLow + pClose) / 3;

  const cHigh = Number(currCandle.high) || 0;
  const cLow = Number(currCandle.low) || 0;
  const cClose = Number(currCandle.close) || 0;
  const cAvg = (cHigh + cLow + cClose) / 3;

  // Day 1 Conditions
  const day1Bullish = pClose > pAvg;
  const day1Bearish = pClose < pAvg;

  // Day 2 Breakout Conditions
  const day2BullishBreakout = cClose > pHigh;
  const day2BearishBreakdown = cClose < pLow;

  const isBullishCbFormation = day1Bullish && day2BullishBreakout;
  const isBearishCbFormation = day1Bearish && day2BearishBreakdown;

  // Next candle (if available in historical stream)
  const nextCandle = currIdx + 1 < candles.length ? candles[currIdx + 1] : null;
  const nextDayHlcHigher = nextCandle ? checkHlcHigher(nextCandle, currCandle) : false;
  const nextDayHlcLower = nextCandle ? checkHlcLower(nextCandle, currCandle) : false;

  // Previous candle before prevCandle (to check if currCandle is the next-day confirmation of previous CB)
  const prevPrevCandle = currIdx >= 2 ? candles[currIdx - 2] : null;
  let prevDayWasBullishCb = false;
  let prevDayWasBearishCb = false;
  if (prevPrevCandle) {
    const ppHigh = Number(prevPrevCandle.high) || 0;
    const ppLow = Number(prevPrevCandle.low) || 0;
    const ppClose = Number(prevPrevCandle.close) || 0;
    const ppAvg = (ppHigh + ppLow + ppClose) / 3;
    prevDayWasBullishCb = pClose > ppHigh && ppClose > ppAvg;
    prevDayWasBearishCb = pClose < ppLow && ppClose < ppAvg;
  }

  // Determine prevailing trend prior to this CB setup:
  // Fast reverse lookup: nearest previous candle that established HLC Higher or Lower
  let priorTrend = null;
  for (let k = currIdx - 1; k >= 1; k--) {
    if (checkHlcHigher(candles[k], candles[k - 1])) {
      priorTrend = "HLC HIGHER";
      break;
    } else if (checkHlcLower(candles[k], candles[k - 1])) {
      priorTrend = "HLC LOWER";
      break;
    }
  }

  // Check if current candle currIdx itself is HLC Higher / Lower relative to prevCandle
  const currIsHlcHigher = checkHlcHigher(currCandle, prevCandle);
  const currIsHlcLower = checkHlcLower(currCandle, prevCandle);

  let isOrdinaryBullish = false;
  let isAdvancedBullish = false;
  let isOrdinaryBearish = false;
  let isAdvancedBearish = false;

  if (isBullishCbFormation) {
    if (priorTrend === "HLC HIGHER") {
      // HLC HIGHER occurred first -> compulsory Ordinary CB made after HLC Higher
      isOrdinaryBullish = true;
    } else if (nextDayHlcHigher) {
      // Next day is compulsory HLC HIGHER -> Advanced CB
      isAdvancedBullish = true;
    } else {
      isOrdinaryBullish = true;
    }
  } else if (prevDayWasBullishCb && currIsHlcHigher) {
    // Current candle is the NEXT DAY where HLC HIGHER formed after CB
    isAdvancedBullish = true;
  }

  if (isBearishCbFormation) {
    if (priorTrend === "HLC LOWER") {
      // HLC LOWER occurred first -> compulsory Ordinary CB made after HLC Lower
      isOrdinaryBearish = true;
    } else if (nextDayHlcLower) {
      // Next day is compulsory HLC LOWER -> Advanced CB
      isAdvancedBearish = true;
    } else {
      isOrdinaryBearish = true;
    }
  } else if (prevDayWasBearishCb && currIsHlcLower) {
    // Current candle is the NEXT DAY where HLC LOWER formed after CB
    isAdvancedBearish = true;
  }

  const isBullish = isOrdinaryBullish || isAdvancedBullish;
  const isBearish = isOrdinaryBearish || isAdvancedBearish;

  let cbType = "NO CB";
  let cbCategory = "neutral";
  let statusBadge = "NONE";
  let breakoutMargin = 0;

  if (isAdvancedBullish) {
    cbType = "CB WITH STATUS";
    cbCategory = "bullish_status";
    statusBadge = "ADVANCED CB (NEXT DAY HLC HIGHER)";
    breakoutMargin = Number((((cClose - pHigh) / pHigh) * 100).toFixed(2));
  } else if (isOrdinaryBullish) {
    cbType = "ORDINARY CB";
    cbCategory = "bullish_ordinary";
    statusBadge = "ORDINARY CB (AFTER HLC HIGHER)";
    breakoutMargin = Number((((cClose - pHigh) / pHigh) * 100).toFixed(2));
  } else if (isAdvancedBearish) {
    cbType = "CB WITH STATUS";
    cbCategory = "bearish_status";
    statusBadge = "ADVANCED CB (NEXT DAY HLC LOWER)";
    breakoutMargin = Number((((pLow - cClose) / pLow) * 100).toFixed(2));
  } else if (isOrdinaryBearish) {
    cbType = "ORDINARY CB";
    cbCategory = "bearish_ordinary";
    statusBadge = "ORDINARY CB (AFTER HLC LOWER)";
    breakoutMargin = Number((((pLow - cClose) / pLow) * 100).toFixed(2));
  }

  return {
    cbType,
    cbCategory,
    statusBadge,
    isAdvancedBullish,
    isOrdinaryBullish,
    isAdvancedBearish,
    isOrdinaryBearish,
    isBullishCbWithStatus: isAdvancedBullish,
    isOrdinaryBullishCb: isOrdinaryBullish,
    isBearishCbWithStatus: isAdvancedBearish,
    isOrdinaryBearishCb: isOrdinaryBearish,
    isBullish,
    isBearish,
    breakoutMargin,
    prevClose: pClose,
    prevHigh: pHigh,
    prevLow: pLow,
    prevAvg: Number(pAvg.toFixed(2)),
    currClose: cClose,
    currHigh: cHigh,
    currLow: cLow,
    currAvg: Number(cAvg.toFixed(2)),
  };
}

/**
 * Fast single-pass backtesting across candle sequence
 */
function runCbBacktest(candles) {
  if (!candles || candles.length < 4) {
    return { overallAccuracy: 0, bullishAccuracy: 0, bearishAccuracy: 0, bullHits: 0, bullTotal: 0, bearHits: 0, bearTotal: 0 };
  }

  let bullTotal = 0;
  let bullHits = 0;
  let bearTotal = 0;
  let bearHits = 0;

  for (let i = 1; i < candles.length - 1; i++) {
    const cbRes = evaluateCbAtIndex(candles, i);
    if (!cbRes || (!cbRes.isBullish && !cbRes.isBearish)) continue;

    const curr = candles[i];
    const next = candles[i + 1];

    if (cbRes.isBullish) {
      bullTotal++;
      if (Number(next.high) > Number(curr.close) || Number(next.close) > Number(curr.close)) {
        bullHits++;
      }
    }
    if (cbRes.isBearish) {
      bearTotal++;
      if (Number(next.low) < Number(curr.close) || Number(next.close) < Number(curr.close)) {
        bearHits++;
      }
    }
  }

  const bullishAccuracy = bullTotal > 0 ? Number(((bullHits / bullTotal) * 100).toFixed(1)) : 0;
  const bearishAccuracy = bearTotal > 0 ? Number(((bearHits / bearTotal) * 100).toFixed(1)) : 0;
  const overallAccuracy = (bullTotal + bearTotal) > 0
    ? Number((((bullHits + bearHits) / (bullTotal + bearTotal)) * 100).toFixed(1))
    : 0;

  return {
    overallAccuracy,
    bullishAccuracy,
    bearishAccuracy,
    bullHits,
    bullTotal,
    bearHits,
    bearTotal,
  };
}

/**
 * GET /api/cb-report
 * Run Closing Breakout (Ordinary CB & CB with Status) Scanner
 */
export const getCbReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      filterType = "ALL", // 'ALL' | 'CB_WITH_STATUS' | 'ORDINARY_CB' | 'BULLISH' | 'BEARISH'
      limit = "all",
    } = req.query;

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve date ceiling with fast cached lookup
    let targetDateStr = null;
    if (actionDate) {
      targetDateStr = typeof actionDate === "string" ? actionDate.slice(0, 10) : new Date(actionDate).toISOString().slice(0, 10);
    } else {
      const now = Date.now();
      if (cachedMaxDate && (now - cachedMaxDate.time < MAX_DATE_CACHE_TTL_MS)) {
        targetDateStr = cachedMaxDate.date;
      } else {
        // Fast index lookup on high-liquidity stock
        try {
          const [r] = await pool.query(
            `SELECT \`date\` FROM \`${tableName}\` WHERE \`symbol\` = 'RELIANCE' ORDER BY \`date\` DESC LIMIT 1`
          );
          if (r && r.length > 0 && r[0].date) {
            targetDateStr = typeof r[0].date === "string" ? r[0].date.slice(0, 10) : new Date(r[0].date).toISOString().slice(0, 10);
          }
        } catch (_) {}

        if (!targetDateStr) {
          const [maxRes] = await pool.query(`SELECT MAX(\`date\`) as maxDate FROM \`${tableName}\``);
          targetDateStr = maxRes[0]?.maxDate
            ? (typeof maxRes[0].maxDate === "string" ? maxRes[0].maxDate.slice(0, 10) : new Date(maxRes[0].maxDate).toISOString().slice(0, 10))
            : null;
        }

        if (targetDateStr) {
          cachedMaxDate = { date: targetDateStr, time: now };
        }
      }
    }

    // 2. Check response cache
    const cacheKey = `${exchange}_${indice}_${timeframe}_${targetDateStr || 'latest'}_${filterType}_${limit}`;
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
      return res.status(200).json(cachedEntry.payload);
    }

    // 3. Fetch distinct symbols matching exchange & index
    const symbolRows = await getFilteredSymbols({ exchange, indice });

    if (!symbolRows || symbolRows.length === 0) {
      const emptyPayload = {
        success: true,
        summary: {
          ordinaryBullishCb: 0,
          bullishCbWithStatus: 0,
          ordinaryBearishCb: 0,
          bearishCbWithStatus: 0,
          totalScanned: 0,
          backtest: { overallAccuracy: 0, bullishAccuracy: 0, bearishAccuracy: 0 },
        },
        actionDate: targetDateStr ? formatDateOutput(targetDateStr) : "—",
        rawActionDate: targetDateStr,
        timeframe,
        data: [],
      };
      return res.status(200).json(emptyPayload);
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);

    // 4. Query historical records with optimized timeframe window
    // Daily needs ~60-90 days, Weekly ~210 days, Monthly ~450 days, else 730 days
    const tfLower = String(timeframe).toLowerCase();
    let dayInterval = 90;
    if (tfLower === "daily") {
      dayInterval = 90;
    } else if (tfLower === "weekly") {
      dayInterval = 210;
    } else if (tfLower === "monthly") {
      dayInterval = 450;
    } else {
      dayInterval = 730;
    }

    const placeholders = matchedSymbols.map(() => "?").join(",");
    let dateCondition = "";
    const queryParams = [...matchedSymbols];

    if (targetDateStr) {
      dateCondition = `AND \`date\` >= DATE_SUB(?, INTERVAL ${dayInterval} DAY) AND \`date\` <= ?`;
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
    for (let i = 0; i < allCandleRows.length; i++) {
      const row = allCandleRows[i];
      let arr = candlesBySymbol.get(row.symbol);
      if (!arr) {
        arr = [];
        candlesBySymbol.set(row.symbol, arr);
      }
      arr.push(row);
    }

    const reportRecords = [];
    let ordBullCount = 0;
    let statusBullCount = 0;
    let ordBearCount = 0;
    let statusBearCount = 0;

    let aggregateBullHits = 0;
    let aggregateBullTotal = 0;
    let aggregateBearHits = 0;
    let aggregateBearTotal = 0;

    // Process symbols in chunks with setImmediate to avoid blocking the event loop
    const CHUNK_SIZE = 400;
    for (let i = 0; i < matchedSymbols.length; i++) {
      if (i > 0 && i % CHUNK_SIZE === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      const sym = matchedSymbols[i];
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 2) continue;

      let candles = symDaily;
      if (tfLower !== "daily") {
        candles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      if (!candles || candles.length < 2) continue;

      const currCandle = candles[candles.length - 1];
      const cbRes = evaluateCbAtIndex(candles, candles.length - 1);
      if (!cbRes) continue;

      if (cbRes.isOrdinaryBullishCb) ordBullCount++;
      if (cbRes.isBullishCbWithStatus) statusBullCount++;
      if (cbRes.isOrdinaryBearishCb) ordBearCount++;
      if (cbRes.isBearishCbWithStatus) statusBearCount++;

      // Comparative study focuses on stocks with active breakouts/breakdowns
      if (!cbRes.isBullish && !cbRes.isBearish) continue;

      // Filter by requested category if specified
      if (filterType === "CB_WITH_STATUS" && !cbRes.isBullishCbWithStatus && !cbRes.isBearishCbWithStatus) continue;
      if (filterType === "ORDINARY_CB" && !cbRes.isOrdinaryBullishCb && !cbRes.isOrdinaryBearishCb) continue;
      if (filterType === "BULLISH" && !cbRes.isBullish) continue;
      if (filterType === "BEARISH" && !cbRes.isBearish) continue;

      // Run backtest only on breakout stocks to save hundreds of millions of cycles
      const bt = runCbBacktest(candles);
      aggregateBullHits += bt.bullHits;
      aggregateBullTotal += bt.bullTotal;
      aggregateBearHits += bt.bearHits;
      aggregateBearTotal += bt.bearTotal;

      reportRecords.push({
        symbol: sym,
        price: cbRes.currClose,
        high: cbRes.currHigh,
        low: cbRes.currLow,
        avg: cbRes.currAvg,
        prevClose: cbRes.prevClose,
        prevHigh: cbRes.prevHigh,
        prevLow: cbRes.prevLow,
        prevAvg: cbRes.prevAvg,
        cbType: cbRes.cbType,
        cbCategory: cbRes.cbCategory,
        statusBadge: cbRes.statusBadge,
        isBullish: cbRes.isBullish,
        isBearish: cbRes.isBearish,
        isOrdinaryBullish: cbRes.isOrdinaryBullishCb,
        isAdvancedBullish: cbRes.isBullishCbWithStatus,
        isOrdinaryBearish: cbRes.isOrdinaryBearishCb,
        isAdvancedBearish: cbRes.isBearishCbWithStatus,
        isBullishCbWithStatus: cbRes.isBullishCbWithStatus,
        isBearishCbWithStatus: cbRes.isBearishCbWithStatus,
        breakoutMargin: cbRes.breakoutMargin,
        date: formatDateOutput(currCandle.date),
        rawDate: currCandle.date,
        accuracy: bt.overallAccuracy,
      });
    }

    const overallBullAcc = aggregateBullTotal > 0 ? Number(((aggregateBullHits / aggregateBullTotal) * 100).toFixed(1)) : 0;
    const overallBearAcc = aggregateBearTotal > 0 ? Number(((aggregateBearHits / aggregateBearTotal) * 100).toFixed(1)) : 0;
    const overallTotalAcc = (aggregateBullTotal + aggregateBearTotal) > 0
      ? Number((((aggregateBullHits + aggregateBearHits) / (aggregateBullTotal + aggregateBearTotal)) * 100).toFixed(1))
      : 0;

    const payload = {
      success: true,
      summary: {
        ordinaryBullishCb: ordBullCount,
        bullishCbWithStatus: statusBullCount,
        ordinaryBearishCb: ordBearCount,
        bearishCbWithStatus: statusBearCount,
        totalScanned: matchedSymbols.length,
        backtest: {
          overallAccuracy: overallTotalAcc,
          bullishAccuracy: overallBullAcc,
          bearishAccuracy: overallBearAcc,
          bullHits: aggregateBullHits,
          bullTotal: aggregateBullTotal,
          bearHits: aggregateBearHits,
          bearTotal: aggregateBearTotal,
        },
      },
      actionDate: formatDateOutput(targetDateStr),
      rawActionDate: targetDateStr,
      timeframe,
      filterType,
      count: reportRecords.length,
      data: reportRecords,
    };

    // Cache the successful payload
    responseCache.set(cacheKey, {
      payload,
      timestamp: Date.now(),
    });

    // Clean old cache entries if Map grows
    if (responseCache.size > 50) {
      const oldestKey = responseCache.keys().next().value;
      responseCache.delete(oldestKey);
    }

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

export default {
  getCbReport,
};
