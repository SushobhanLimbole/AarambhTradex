import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";
import { calculateStrategyData } from "../services/strategyFormula.service.js";

/**
 * TREND REVERSAL (BULLISH & BEARISH) INSTITUTIONAL CONTROLLER
 * Formulations matching specification:
 * 
 * 1. BULLISH REVERSAL:
 *    - Running State: "HLC LOWER RUNNING" (Down-Trend)
 *    - Trigger: TODAYS CLOSE > PREV.CLOSE & PREV.AVG
 *    - Matrix: ABOVE / BELOW Y/G/R levels
 * 
 * 2. BEARISH REVERSAL:
 *    - Running State: "HLC HIGHER RUNNING" (Up-Trend)
 *    - Trigger: TODAYS CLOSE < PREV.CLOSE & PREV.AVG
 *    - Matrix: ABOVE / BELOW Y/G/R levels
 * 
 * 3. BACKTESTING ACCURACY IN %:
 *    - Historical follow-through % verification across candle history
 */

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
 * Evaluate HLC Running Trend on previous candles
 */
function getRunningHlcTrend(candles) {
  if (!candles || candles.length < 2) {
    return { runningTrend: "NEUTRAL", trendDate: null };
  }

  let runningTrend = "HLC HIGHER RUNNING"; // default
  let trendDate = candles[0].date;

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const cHigh = Number(curr.high) || 0;
    const cLow = Number(curr.low) || 0;
    const cClose = Number(curr.close) || 0;

    const pHigh = Number(prev.high) || 0;
    const pLow = Number(prev.low) || 0;
    const pClose = Number(prev.close) || 0;

    const isHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
    const isHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

    if (isHlcHigher) {
      runningTrend = "HLC HIGHER RUNNING";
      trendDate = curr.date;
    } else if (isHlcLower) {
      runningTrend = "HLC LOWER RUNNING";
      trendDate = curr.date;
    }
  }

  return { runningTrend, trendDate };
}

/**
 * Evaluate Pointer Y/G/R Band position for a given price
 */
function evaluateYgrPosition(price, triggers) {
  if (!triggers || !price) return "—";
  const { yellow, green, red } = triggers;

  if (price > yellow.Y6) return "ABOVE Y6 (Extreme Bullish)";
  if (price > yellow.Y3) return "ABOVE Y3 (Upper Bullish)";
  if (price > yellow.Y1) return "ABOVE Y1 (Yellow Band)";
  if (price >= green.G1 && price <= yellow.Y1) return "BETWEEN G1 - Y1";
  if (price >= red.R3 && price <= green.G1) return "BETWEEN R3 - G1";
  if (price < red.R6) return "BELOW R6 (Extreme Bearish)";
  if (price < red.R1) return "BELOW R1 (Lower Bearish)";
  if (price < red.R3) return "BELOW R3 (Red Band)";

  return "WITHIN Y/G/R CHANNELS";
}

/**
 * Evaluate single candle pair for Bullish/Bearish reversal
 */
function evaluateReversal(candlesUpToPrev, currCandle) {
  if (!candlesUpToPrev || candlesUpToPrev.length < 1 || !currCandle) return null;

  const prevCandle = candlesUpToPrev[candlesUpToPrev.length - 1];
  const { runningTrend } = getRunningHlcTrend(candlesUpToPrev);

  const cHigh = Number(currCandle.high) || 0;
  const cLow = Number(currCandle.low) || 0;
  const cClose = Number(currCandle.close) || 0;

  const pHigh = Number(prevCandle.high) || 0;
  const pLow = Number(prevCandle.low) || 0;
  const pClose = Number(prevCandle.close) || 0;
  const pAvg = (pHigh + pLow + pClose) / 3;

  const prevStrategy = calculateStrategyData({
    open: prevCandle.open,
    high: prevCandle.high,
    low: prevCandle.low,
    close: prevCandle.close,
  });

  const isHlcLowerRunning = runningTrend === "HLC LOWER RUNNING";
  const isHlcHigherRunning = runningTrend === "HLC HIGHER RUNNING";

  // Check if current candle itself forms HLC Higher or HLC Lower
  const isCurrHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
  const isCurrHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

  // 1. Bullish Reversal (Sell to Buy Reversal / Bullish Zone Trigger):
  //    - Prior trend is HLC LOWER RUNNING
  //    - Today's Close > Previous Close AND Today's Close > Previous Average (GREEN ZONE)
  //    - Rule: If today's candle itself forms HLC HIGHER, don't add it as a reversal trigger (move to next)
  const isBullishReversal = isHlcLowerRunning && cClose > pClose && cClose > pAvg && !isCurrHlcHigher;

  // 2. Bearish Reversal (Buy to Sell Reversal / Bearish Zone Trigger):
  //    - Prior trend is HLC HIGHER RUNNING (e.g. 15 Sept HLC Higher)
  //    - Today's Close < Previous Close AND Today's Close < Previous Average (RED ZONE)
  //    - Rule: If today's candle itself forms HLC LOWER, don't add it as a reversal trigger (move to next stock)
  const isBearishReversal = isHlcHigherRunning && cClose < pClose && cClose < pAvg && !isCurrHlcLower;

  const ygrBand = evaluateYgrPosition(cClose, prevStrategy.triggers);

  return {
    runningTrend,
    isBullishReversal,
    isBearishReversal,
    currClose: cClose,
    prevClose: pClose,
    prevAvg: Number(pAvg.toFixed(2)),
    ygrBand,
    triggers: prevStrategy.triggers,
  };
}

/**
 * Backtesting Reversal continuation accuracy
 */
function runReversalBacktest(candles) {
  if (!candles || candles.length < 4) {
    return { overallAccuracy: 0, bullishAccuracy: 0, bearishAccuracy: 0, bullHits: 0, bullTotal: 0, bearHits: 0, bearTotal: 0 };
  }

  let bullTotal = 0;
  let bullHits = 0;
  let bearTotal = 0;
  let bearHits = 0;

  let runningTrend = "HLC HIGHER RUNNING";

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    const cHigh = Number(curr.high) || 0;
    const cLow = Number(curr.low) || 0;
    const cClose = Number(curr.close) || 0;

    const pHigh = Number(prev.high) || 0;
    const pLow = Number(prev.low) || 0;
    const pClose = Number(prev.close) || 0;
    const pAvg = (pHigh + pLow + pClose) / 3;

    const isCurrHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
    const isCurrHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

    const isBullish = runningTrend === "HLC LOWER RUNNING" && cClose > pClose && cClose > pAvg && !isCurrHlcHigher;
    const isBearish = runningTrend === "HLC HIGHER RUNNING" && cClose < pClose && cClose < pAvg && !isCurrHlcLower;

    if (isBullish) {
      bullTotal++;
      if (Number(next.high) > cClose || Number(next.close) > cClose) {
        bullHits++;
      }
    }
    if (isBearish) {
      bearTotal++;
      if (Number(next.low) < cClose || Number(next.close) < cClose) {
        bearHits++;
      }
    }

    // Update running trend for next iteration
    if (isCurrHlcHigher) runningTrend = "HLC HIGHER RUNNING";
    else if (isCurrHlcLower) runningTrend = "HLC LOWER RUNNING";
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
 * GET /api/trend-reversal
 * Run Trend Reversal Bullish-Bearish Scanner
 */
export const getTrendReversalReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily", // Default Daily timeframe
      actionDate,
      reversalType = "ALL", // 'ALL' | 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL'
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
        summary: {
          bullishReversals: 0,
          bearishReversals: 0,
          totalScanned: 0,
          backtest: { overallAccuracy: 0, bullishAccuracy: 0, bearishAccuracy: 0 },
        },
        actionDate: targetDateStr,
        timeframe,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);

    // 3. Query historical records (past 730 days for robust candle calculations)
    const placeholders = matchedSymbols.map(() => "?").join(",");
    let dateCondition = "";
    const queryParams = [...matchedSymbols];

    if (targetDateStr) {
      dateCondition = "AND `date` >= DATE_SUB(?, INTERVAL 730 DAY) AND `date` <= ?";
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

    const reportRecords = [];
    let bullishReversalsCount = 0;
    let bearishReversalsCount = 0;

    let aggregateBullHits = 0;
    let aggregateBullTotal = 0;
    let aggregateBearHits = 0;
    let aggregateBearTotal = 0;

    for (const sym of matchedSymbols) {
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 3) continue;

      // Resample candles according to timeframe
      let candles = symDaily;
      if (String(timeframe).toLowerCase() !== "daily") {
        candles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      if (!candles || candles.length < 3) continue;

      const priorSlice = candles.slice(0, candles.length - 1);
      const currCandle = candles[candles.length - 1];

      const resEval = evaluateReversal(priorSlice, currCandle);
      if (!resEval) continue;

      // Run backtest
      const bt = runReversalBacktest(candles);
      aggregateBullHits += bt.bullHits;
      aggregateBullTotal += bt.bullTotal;
      aggregateBearHits += bt.bearHits;
      aggregateBearTotal += bt.bearTotal;

      if (resEval.isBullishReversal) {
        bullishReversalsCount++;
      }
      if (resEval.isBearishReversal) {
        bearishReversalsCount++;
      }

      // Trend Reversal Report only includes stocks that actually triggered a reversal
      if (!resEval.isBullishReversal && !resEval.isBearishReversal) continue;

      // Filter by requested reversal type
      if (reversalType === "BULLISH_REVERSAL" && !resEval.isBullishReversal) continue;
      if (reversalType === "BEARISH_REVERSAL" && !resEval.isBearishReversal) continue;

      let reversalStatus = "NO REVERSAL";
      let reversalColor = "neutral";
      let zone = "—";
      let zoneColor = "neutral";

      if (resEval.isBullishReversal) {
        reversalStatus = "BULLISH REVERSAL";
        reversalColor = "bullish";
        zone = "GREEN";
        zoneColor = "green";
      } else if (resEval.isBearishReversal) {
        reversalStatus = "BEARISH REVERSAL";
        reversalColor = "bearish";
        zone = "RED";
        zoneColor = "red";
      }

      const currStatus = resEval.runningTrend === "HLC HIGHER RUNNING" ? "HLC HIGHER" : (resEval.runningTrend === "HLC LOWER RUNNING" ? "HLC LOWER" : "—");

      reportRecords.push({
        symbol: sym,
        price: resEval.currClose,
        prevClose: resEval.prevClose,
        prevAvg: resEval.prevAvg,
        runningTrend: resEval.runningTrend,
        currStatus,
        zone,
        zoneColor,
        reversalStatus,
        reversalColor,
        isBullishReversal: resEval.isBullishReversal,
        isBearishReversal: resEval.isBearishReversal,
        ygrBand: resEval.ygrBand,
        triggers: resEval.triggers,
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

    return res.status(200).json({
      success: true,
      summary: {
        bullishReversals: bullishReversalsCount,
        bearishReversals: bearishReversalsCount,
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
      reversalType,
      count: reportRecords.length,
      data: reportRecords,
    });
  } catch (error) {
    next(error);
  }
};
