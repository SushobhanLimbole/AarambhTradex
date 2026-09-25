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
 * Evaluate CB & CB with Status between Day 1 (prev) and Day 2 (curr)
 */
function evaluateCbCandles(prevCandle, currCandle) {
  if (!prevCandle || !currCandle) return null;

  const pOpen = Number(prevCandle.open) || 0;
  const pHigh = Number(prevCandle.high) || 0;
  const pLow = Number(prevCandle.low) || 0;
  const pClose = Number(prevCandle.close) || 0;
  const pAvg = (pHigh + pLow + pClose) / 3;

  const cOpen = Number(currCandle.open) || 0;
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

  // Day 2 HLC Higher / Lower formation
  const day2HlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
  const day2HlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

  // Bullish Classifications
  const isOrdinaryBullishCb = day1Bullish && day2BullishBreakout;
  const isBullishCbWithStatus = isOrdinaryBullishCb && day2HlcHigher;

  // Bearish Classifications
  const isOrdinaryBearishCb = day1Bearish && day2BearishBreakdown;
  const isBearishCbWithStatus = isOrdinaryBearishCb && day2HlcLower;

  let cbType = "NO CB";
  let cbCategory = "neutral";
  let statusBadge = "NONE";
  let breakoutMargin = 0;

  if (isBullishCbWithStatus) {
    cbType = "CB WITH STATUS";
    cbCategory = "bullish_status";
    statusBadge = "ON DAY 2 HLC HIGHER FORMED";
    breakoutMargin = Number((((cClose - pHigh) / pHigh) * 100).toFixed(2));
  } else if (isOrdinaryBullishCb) {
    cbType = "ORDINARY CB";
    cbCategory = "bullish_ordinary";
    statusBadge = "DAY 2 CLOSE > PREV HIGH";
    breakoutMargin = Number((((cClose - pHigh) / pHigh) * 100).toFixed(2));
  } else if (isBearishCbWithStatus) {
    cbType = "CB WITH STATUS";
    cbCategory = "bearish_status";
    statusBadge = "ON DAY 2 HLC LOWER FORMED";
    breakoutMargin = Number((((pLow - cClose) / pLow) * 100).toFixed(2));
  } else if (isOrdinaryBearishCb) {
    cbType = "ORDINARY CB";
    cbCategory = "bearish_ordinary";
    statusBadge = "DAY 2 CLOSE < PREV LOW";
    breakoutMargin = Number((((pLow - cClose) / pLow) * 100).toFixed(2));
  }

  return {
    cbType,
    cbCategory,
    statusBadge,
    isBullishCbWithStatus,
    isOrdinaryBullishCb,
    isBearishCbWithStatus,
    isOrdinaryBearishCb,
    isBullish: isOrdinaryBullishCb,
    isBearish: isOrdinaryBearishCb,
    breakoutMargin,
    prevClose: pClose,
    prevHigh: pHigh,
    prevLow: pLow,
    prevAvg: Number(pAvg.toFixed(2)),
    currClose: cClose,
    currHigh: cHigh,
    currLow: cLow,
    currAvg: Number(cAvg.toFixed(2)),
    day2HlcHigher,
    day2HlcLower,
  };
}

/**
 * Run linear single-pass backtesting across candle sequence
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
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    const cbRes = evaluateCbCandles(prev, curr);
    if (!cbRes || (!cbRes.isBullish && !cbRes.isBearish)) continue;

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
          ordinaryBullishCb: 0,
          bullishCbWithStatus: 0,
          ordinaryBearishCb: 0,
          bearishCbWithStatus: 0,
          totalScanned: 0,
          backtest: { overallAccuracy: 0, bullishAccuracy: 0, bearishAccuracy: 0 },
        },
        actionDate: targetDateStr,
        timeframe,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);

    // 3. Query historical records (past 730 days for robust timeframe calculations)
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
    let ordBullCount = 0;
    let statusBullCount = 0;
    let ordBearCount = 0;
    let statusBearCount = 0;

    let aggregateBullHits = 0;
    let aggregateBullTotal = 0;
    let aggregateBearHits = 0;
    let aggregateBearTotal = 0;

    for (const sym of matchedSymbols) {
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 2) continue;

      let candles = symDaily;
      if (String(timeframe).toLowerCase() !== "daily") {
        candles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      if (!candles || candles.length < 2) continue;

      const prevCandle = candles[candles.length - 2];
      const currCandle = candles[candles.length - 1];

      const cbRes = evaluateCbCandles(prevCandle, currCandle);
      if (!cbRes) continue;

      const bt = runCbBacktest(candles);
      aggregateBullHits += bt.bullHits;
      aggregateBullTotal += bt.bullTotal;
      aggregateBearHits += bt.bearHits;
      aggregateBearTotal += bt.bearTotal;

      if (cbRes.isOrdinaryBullishCb) ordBullCount++;
      if (cbRes.isBullishCbWithStatus) statusBullCount++;
      if (cbRes.isOrdinaryBearishCb) ordBearCount++;
      if (cbRes.isBearishCbWithStatus) statusBearCount++;

      // Filter by requested category
      if (filterType === "CB_WITH_STATUS" && !cbRes.isBullishCbWithStatus && !cbRes.isBearishCbWithStatus) continue;
      if (filterType === "ORDINARY_CB" && !cbRes.isOrdinaryBullishCb && !cbRes.isOrdinaryBearishCb) continue;
      if (filterType === "BULLISH" && !cbRes.isBullish) continue;
      if (filterType === "BEARISH" && !cbRes.isBearish) continue;

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

    return res.status(200).json({
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
    });
  } catch (error) {
    next(error);
  }
};
