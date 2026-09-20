import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { calculateStrategyData } from "../services/strategyFormula.service.js";

/**
 * AB TOP & BLW BOTTOM (Above Top & Below Bottom) Institutional Report Controller
 * Computes:
 * - "CLOSING ABOVE AB TOP" (Closed above Y1-Y6 triggers)
 * - "CLOSING BELOW AB BOTTOM" (Closed below R1-R6 triggers)
 * - Exact level breached (Y1-Y6 / R1-R6)
 * - Multi-Timeframe support (Daily, Weekly, Monthly, Quarterly, Half-Yearly, Yearly)
 * - Backtesting accuracy engine (% success of continuation after breakout/breakdown)
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
 * Determine AB Top / Below Bottom breakout status between reference candle and current candle
 */
function evaluateAbTopBottom(prevCandle, currCandle) {
  if (!prevCandle || !currCandle) return null;

  const prevStrategy = calculateStrategyData({
    open: prevCandle.open,
    high: prevCandle.high,
    low: prevCandle.low,
    close: prevCandle.close,
  });

  const currClose = Number(currCandle.close) || 0;
  const currHigh = Number(currCandle.high) || 0;
  const currLow = Number(currCandle.low) || 0;

  const { yellow, red } = prevStrategy.triggers;
  // Yellow triggers (Y1 - Y6)
  const yLevels = [
    { name: "Y6", val: yellow.Y6 },
    { name: "Y5", val: yellow.Y5 },
    { name: "Y4", val: yellow.Y4 },
    { name: "Y3", val: yellow.Y3 },
    { name: "Y2", val: yellow.Y2 },
    { name: "Y1", val: yellow.Y1 },
  ];

  // Red triggers (R1 - R6)
  const rLevels = [
    { name: "R6", val: red.R6 },
    { name: "R5", val: red.R5 },
    { name: "R4", val: red.R4 },
    { name: "R1", val: red.R1 },
    { name: "R2", val: red.R2 },
    { name: "R3", val: red.R3 },
  ];

  let isAbTop = false;
  let highestBreachedY = null;
  let topDelta = 0;

  // Check top breach: currClose > Y1..Y6
  for (const y of yLevels) {
    if (currClose > y.val) {
      isAbTop = true;
      highestBreachedY = y;
      topDelta = ((currClose - y.val) / y.val) * 100;
      break;
    }
  }

  let isAbBottom = false;
  let lowestBreachedR = null;
  let bottomDelta = 0;

  // Check bottom breach: currClose < R1..R6
  // R6 is lowest, R3 is highest of red triggers
  for (const r of rLevels) {
    if (currClose < r.val) {
      isAbBottom = true;
      lowestBreachedR = r;
      bottomDelta = ((r.val - currClose) / r.val) * 100;
      break;
    }
  }

  return {
    isAbTop,
    topLevel: highestBreachedY ? highestBreachedY.name : null,
    topTriggerVal: highestBreachedY ? highestBreachedY.val : null,
    topDeltaPercent: topDelta ? Number(topDelta.toFixed(2)) : 0,

    isAbBottom,
    bottomLevel: lowestBreachedR ? lowestBreachedR.name : null,
    bottomTriggerVal: lowestBreachedR ? lowestBreachedR.val : null,
    bottomDeltaPercent: bottomDelta ? Number(bottomDelta.toFixed(2)) : 0,

    prevClose: Number(prevCandle.close),
    currClose,
    currHigh,
    currLow,
    triggers: { yellow, red },
  };
}

/**
 * Backtest historical accuracy across candle series for AB Top / AB Bottom follow-through
 */
function runBacktest(candles) {
  if (!candles || candles.length < 5) {
    return { topAccuracy: 0, bottomAccuracy: 0, topHits: 0, topTotal: 0, bottomHits: 0, bottomTotal: 0 };
  }

  let topTotal = 0;
  let topHits = 0;
  let bottomTotal = 0;
  let bottomHits = 0;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    const evalResult = evaluateAbTopBottom(prev, curr);
    if (!evalResult) continue;

    // AB TOP Continuation Test: Next candle high > curr close or next close > curr close
    if (evalResult.isAbTop) {
      topTotal++;
      if (Number(next.high) > Number(curr.close) || Number(next.close) > Number(curr.close)) {
        topHits++;
      }
    }

    // AB BOTTOM Continuation Test: Next candle low < curr close or next close < curr close
    if (evalResult.isAbBottom) {
      bottomTotal++;
      if (Number(next.low) < Number(curr.close) || Number(next.close) < Number(curr.close)) {
        bottomHits++;
      }
    }
  }

  const topAccuracy = topTotal > 0 ? Number(((topHits / topTotal) * 100).toFixed(1)) : 0;
  const bottomAccuracy = bottomTotal > 0 ? Number(((bottomHits / bottomTotal) * 100).toFixed(1)) : 0;

  return {
    topAccuracy,
    bottomAccuracy,
    topHits,
    topTotal,
    bottomHits,
    bottomTotal,
    overallAccuracy: (topTotal + bottomTotal) > 0 ? Number((((topHits + bottomHits) / (topTotal + bottomTotal)) * 100).toFixed(1)) : 0,
  };
}

/**
 * GET /api/ab-top-bottom
 * Run the AB TOP & BELOW BOTTOM Report Scanner
 */
export const getAbTopBottomReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Monthly", // Default monthly pointer matching image
      actionDate,
      filterType = "ALL", // 'ALL' | 'AB_TOP' | 'AB_BOTTOM'
      limit = "all",
    } = req.query;

    const normExch = String(exchange || "").toUpperCase();
    const normInd = String(indice || "").toLowerCase();
    const tableName = (normExch === "CRYPTO" || normExch === "METALS" || normInd === "crypto" || normInd === "metals")
      ? "global_assets"
      : (process.env.MYSQL_HISTORICAL_TABLE || process.env.MYSQL_STOCK_TABLE || "historical_candles");

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
      if (cleanIdx.toUpperCase() !== "TOP 500") {
        symQuery += " AND (LOWER(`indice`) = LOWER(?) OR LOWER(`indice`) LIKE LOWER(?))";
        symParams.push(cleanIdx, `%${cleanIdx}%`);
      }
    }

    symQuery += " ORDER BY `symbol` ASC";
    const [symbolRows] = await pool.query(symQuery, symParams);

    if (!symbolRows || symbolRows.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          closingAboveAbTop: 0,
          closingBelowAbBottom: 0,
          totalScanned: 0,
          backtest: { overallAccuracy: 0, topAccuracy: 0, bottomAccuracy: 0 },
        },
        actionDate: targetDateStr,
        timeframe,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);

    // 3. Query historical records (past 730 days for robust timeframe aggregations)
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
    let closingAboveAbTopCount = 0;
    let closingBelowAbBottomCount = 0;

    let aggregateTopHits = 0;
    let aggregateTopTotal = 0;
    let aggregateBottomHits = 0;
    let aggregateBottomTotal = 0;

    for (const sym of matchedSymbols) {
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 2) continue;

      // Resample candles according to timeframe
      let candles = symDaily;
      if (String(timeframe).toLowerCase() !== "daily") {
        candles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      if (!candles || candles.length < 2) continue;

      const prevCandle = candles[candles.length - 2];
      const currCandle = candles[candles.length - 1];

      const resEval = evaluateAbTopBottom(prevCandle, currCandle);
      if (!resEval) continue;

      // Run backtest across candle history
      const bt = runBacktest(candles);
      aggregateTopHits += bt.topHits;
      aggregateTopTotal += bt.topTotal;
      aggregateBottomHits += bt.bottomHits;
      aggregateBottomTotal += bt.bottomTotal;

      if (resEval.isAbTop) {
        closingAboveAbTopCount++;
      }
      if (resEval.isAbBottom) {
        closingBelowAbBottomCount++;
      }

      // Filter by type if specified
      if (filterType === "AB_TOP" && !resEval.isAbTop) continue;
      if (filterType === "AB_BOTTOM" && !resEval.isAbBottom) continue;

      let statusLabel = "NEUTRAL";
      let statusColor = "neutral";
      if (resEval.isAbTop && resEval.isAbBottom) {
        statusLabel = "AB TOP & BOTTOM";
        statusColor = "both";
      } else if (resEval.isAbTop) {
        statusLabel = "ABOVE TOP";
        statusColor = "top"; // Red theme
      } else if (resEval.isAbBottom) {
        statusLabel = "BELOW BOTTOM";
        statusColor = "bottom"; // Green theme
      }

      reportRecords.push({
        symbol: sym,
        price: resEval.currClose,
        prevClose: resEval.prevClose,
        high: resEval.currHigh,
        low: resEval.currLow,
        status: statusLabel,
        statusColor,
        isAbTop: resEval.isAbTop,
        topLevel: resEval.topLevel,
        topTriggerVal: resEval.topTriggerVal,
        topDeltaPercent: resEval.topDeltaPercent,
        isAbBottom: resEval.isAbBottom,
        bottomLevel: resEval.bottomLevel,
        bottomTriggerVal: resEval.bottomTriggerVal,
        bottomDeltaPercent: resEval.bottomDeltaPercent,
        date: formatDateOutput(currCandle.date),
        rawDate: currCandle.date,
        triggers: resEval.triggers,
        accuracy: bt.overallAccuracy,
      });
    }

    const overallTopAcc = aggregateTopTotal > 0 ? Number(((aggregateTopHits / aggregateTopTotal) * 100).toFixed(1)) : 0;
    const overallBottomAcc = aggregateBottomTotal > 0 ? Number(((aggregateBottomHits / aggregateBottomTotal) * 100).toFixed(1)) : 0;
    const overallTotalAcc = (aggregateTopTotal + aggregateBottomTotal) > 0
      ? Number((((aggregateTopHits + aggregateBottomHits) / (aggregateTopTotal + aggregateBottomTotal)) * 100).toFixed(1))
      : 0;

    return res.status(200).json({
      success: true,
      summary: {
        closingAboveAbTop: closingAboveAbTopCount,
        closingBelowAbBottom: closingBelowAbBottomCount,
        totalScanned: matchedSymbols.length,
        backtest: {
          overallAccuracy: overallTotalAcc,
          topAccuracy: overallTopAcc,
          bottomAccuracy: overallBottomAcc,
          topHits: aggregateTopHits,
          topTotal: aggregateTopTotal,
          bottomHits: aggregateBottomHits,
          bottomTotal: aggregateBottomTotal,
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
