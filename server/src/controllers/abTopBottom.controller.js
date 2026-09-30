import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * TOP AND BOTTOM EXTREME ZONE (AB TOP & BOTTOM EXTREME ZONE) Report Controller
 * Logic:
 * 1. Identify HLC HIGHER / LOWER transitions.
 * 2. Absolute Top (AB TOP) is formed at the peak candle between HLC HIGHER and HLC LOWER.
 *    Scan subsequent candles after AB TOP: first time close > topClose AND avg > topAvg -> "ABOVE EXTREME TOP".
 * 3. Absolute Bottom (AB BOTTOM) is formed at the trough candle between HLC LOWER and HLC HIGHER.
 *    Scan subsequent candles after AB BOTTOM: first time close < bottomClose AND avg < bottomAvg -> "ABOVE EXTREME BOTTOM".
 * 4. Multi-Timeframe support (Daily, Weekly, Monthly, Quarterly, Half-Yearly, Yearly).
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
 * Detect Extreme Top & Bottom Zone Signals across candles for a symbol
 * 1. Extreme Absolute Top (Breakout):
 *    - Pivot Baseline: Top High (High of the Absolute Top candle)
 *    - Forward Scan: Chronologically evaluate subsequent days
 *    - Trigger Condition: First occurrence where Close > Top High AND Avg > Top High
 * 2. Extreme Absolute Bottom (Breakdown):
 *    - Pivot Baseline: Bottom Low (Low of the Absolute Bottom candle)
 *    - Forward Scan: Chronologically evaluate subsequent days
 *    - Trigger Condition: First occurrence where Close < Bottom Low AND Avg < Bottom Low
 */
function detectExtremeZoneSignals(candles, sym, exchange) {
  if (!candles || candles.length < 3) return [];

  // 1. Calculate HLC Higher / Lower transitions across candles (chronological ASC)
  const events = []; // Array of { idx, type: 'HLC HIGHER' | 'HLC LOWER' }
  let currentMode = null;

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
      if (currentMode !== "HLC HIGHER") {
        currentMode = "HLC HIGHER";
        events.push({ idx: i, type: "HLC HIGHER" });
      }
    } else if (isHlcLower) {
      if (currentMode !== "HLC LOWER") {
        currentMode = "HLC LOWER";
        events.push({ idx: i, type: "HLC LOWER" });
      }
    }
  }

  // 2. Identify all AB TOP and AB BOTTOM pivots (strictly formed between HLC transitions)
  const topPivots = [];
  const bottomPivots = [];

  for (let e = 1; e < events.length; e++) {
    const prevEv = events[e - 1];
    const currEv = events[e];

    if (prevEv.type === "HLC HIGHER" && currEv.type === "HLC LOWER") {
      // AB TOP: Highest High strictly between HLC HIGHER and HLC LOWER
      if (currEv.idx > prevEv.idx + 1) {
        let bestIdx = -1;
        let maxHigh = -Infinity;
        for (let k = prevEv.idx + 1; k < currEv.idx; k++) {
          const h = Number(candles[k].high) || 0;
          if (h >= maxHigh) {
            maxHigh = h;
            bestIdx = k;
          }
        }
        if (bestIdx !== -1) {
          topPivots.push({ idx: bestIdx, candle: candles[bestIdx] });
        }
      }
    } else if (prevEv.type === "HLC LOWER" && currEv.type === "HLC HIGHER") {
      // AB BOTTOM: Lowest Low strictly between HLC LOWER and HLC HIGHER
      if (currEv.idx > prevEv.idx + 1) {
        let bestIdx = -1;
        let minLow = Infinity;
        for (let k = prevEv.idx + 1; k < currEv.idx; k++) {
          const l = Number(candles[k].low) || Infinity;
          if (l <= minLow) {
            minLow = l;
            bestIdx = k;
          }
        }
        if (bestIdx !== -1) {
          bottomPivots.push({ idx: bestIdx, candle: candles[bestIdx] });
        }
      }
    }
  }

  const signals = [];

  // 3. Evaluate Extreme AB TOP pivots: forward scan bounded by next top pivot formation
  for (let p = 0; p < topPivots.length; p++) {
    const pivot = topPivots[p];
    const nextPivotIdx = p + 1 < topPivots.length ? topPivots[p + 1].idx : candles.length;
    const topCandle = pivot.candle;
    const topHigh = Number(topCandle.high) || 0;
    const topLow = Number(topCandle.low) || 0;
    const topClose = Number(topCandle.close) || 0;
    const topAvg = (topHigh + topLow + topClose) / 3;

    for (let j = pivot.idx + 1; j < nextPivotIdx; j++) {
      const nextCandle = candles[j];
      const nextClose = Number(nextCandle.close) || 0;
      const nextHigh = Number(nextCandle.high) || 0;
      const nextLow = Number(nextCandle.low) || 0;
      const nextAvg = (nextHigh + nextLow + nextClose) / 3;

      if (nextClose > topHigh && nextAvg > topHigh) {
        signals.push({
          symbol: sym,
          exchange: exchange || "NSE",
          scenario: "extreme Ab top",
          scenarioType: "top",
          date: formatDateOutput(nextCandle.date),
          rawDate: typeof nextCandle.date === "string" ? nextCandle.date.slice(0, 10) : new Date(nextCandle.date).toISOString().slice(0, 10),
          cmp: nextClose,
          refDate: formatDateOutput(topCandle.date),
          refBaseline: topHigh,
          refHigh: topHigh,
          refLow: topLow,
          refClose: topClose,
          refAvg: Number(topAvg.toFixed(2)),
          triggerClose: nextClose,
          triggerAvg: Number(nextAvg.toFixed(2)),
        });
        break; // First occurrence stop rule for this pivot cycle
      }
    }
  }

  // 4. Evaluate Extreme AB BOTTOM pivots: forward scan bounded by next bottom pivot formation
  for (let p = 0; p < bottomPivots.length; p++) {
    const pivot = bottomPivots[p];
    const nextPivotIdx = p + 1 < bottomPivots.length ? bottomPivots[p + 1].idx : candles.length;
    const bottomCandle = pivot.candle;
    const bottomHigh = Number(bottomCandle.high) || 0;
    const bottomLow = Number(bottomCandle.low) || 0;
    const bottomClose = Number(bottomCandle.close) || 0;
    const bottomAvg = (bottomHigh + bottomLow + bottomClose) / 3;

    for (let j = pivot.idx + 1; j < nextPivotIdx; j++) {
      const nextCandle = candles[j];
      const nextClose = Number(nextCandle.close) || 0;
      const nextHigh = Number(nextCandle.high) || 0;
      const nextLow = Number(nextCandle.low) || 0;
      const nextAvg = (nextHigh + nextLow + nextClose) / 3;

      if (nextClose < bottomLow && nextAvg < bottomLow) {
        signals.push({
          symbol: sym,
          exchange: exchange || "NSE",
          scenario: "extreme Ab bottom",
          scenarioType: "bottom",
          date: formatDateOutput(nextCandle.date),
          rawDate: typeof nextCandle.date === "string" ? nextCandle.date.slice(0, 10) : new Date(nextCandle.date).toISOString().slice(0, 10),
          cmp: nextClose,
          refDate: formatDateOutput(bottomCandle.date),
          refBaseline: bottomLow,
          refHigh: bottomHigh,
          refLow: bottomLow,
          refClose: bottomClose,
          refAvg: Number(bottomAvg.toFixed(2)),
          triggerClose: nextClose,
          triggerAvg: Number(nextAvg.toFixed(2)),
        });
        break; // First occurrence stop rule for this pivot cycle
      }
    }
  }

  return signals;
}

/**
 * GET /api/ab-top-bottom
 * Run the TOP AND BOTTOM EXTREME ZONE Report Scanner
 */
export const getAbTopBottomReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily", // Default Daily timeframe
      actionDate,
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
          closingAboveAbTop: 0,
          closingBelowAbBottom: 0,
          totalScanned: 0,
        },
        actionDate: formatDateOutput(targetDateStr),
        rawActionDate: targetDateStr,
        timeframe,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);
    const symbolExchangeMap = new Map();
    symbolRows.forEach((r) => {
      symbolExchangeMap.set(r.symbol, r.exchange || exchange || "NSE");
    });

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

    let allSignals = [];
    let closingAboveAbTopCount = 0;
    let closingBelowAbBottomCount = 0;

    for (const sym of matchedSymbols) {
      const symDaily = candlesBySymbol.get(sym);
      if (!symDaily || symDaily.length < 3) continue;

      // Resample candles according to timeframe
      let candles = symDaily;
      if (String(timeframe).toLowerCase() !== "daily") {
        candles = StockDataModel.resampleCandles(symDaily, timeframe);
      }

      if (!candles || candles.length < 3) continue;

      const symExchange = symbolExchangeMap.get(sym) || exchange || "NSE";
      const symSignals = detectExtremeZoneSignals(candles, sym, symExchange);

      for (const sig of symSignals) {
        allSignals.push(sig);
        if (sig.scenarioType === "top") {
          closingAboveAbTopCount++;
        } else if (sig.scenarioType === "bottom") {
          closingBelowAbBottomCount++;
        }
      }
    }

    // 4. Filter signals for the target date if signals exist on that date, or return all recent signals
    let displaySignals = allSignals;
    if (targetDateStr) {
      const exactDateSignals = allSignals.filter((s) => s.rawDate === targetDateStr);
      if (exactDateSignals.length > 0) {
        displaySignals = exactDateSignals;
      }
    }

    // Sort signals newest date first
    displaySignals.sort((a, b) => {
      const tA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
      const tB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return a.symbol.localeCompare(b.symbol);
    });

    let topCount = 0;
    let bottomCount = 0;
    for (const sig of displaySignals) {
      if (sig.scenarioType === "top") topCount++;
      else if (sig.scenarioType === "bottom") bottomCount++;
    }

    return res.status(200).json({
      success: true,
      summary: {
        closingAboveAbTop: topCount,
        closingBelowAbBottom: bottomCount,
        totalScanned: matchedSymbols.length,
      },
      actionDate: formatDateOutput(targetDateStr),
      rawActionDate: targetDateStr,
      timeframe,
      count: displaySignals.length,
      data: displaySignals,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAbTopBottomReport,
};
