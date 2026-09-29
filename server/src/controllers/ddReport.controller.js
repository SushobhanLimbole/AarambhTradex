import pool from "../config/mysql.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * TWIN TOWER (DIRECTIONAL SHIFT) REPORT CONTROLLER
 * 
 * Exact formulation matching specification:
 * 1. BULLISH Twin Tower:
 *    - The previous HLC status event was HLC LOWER (Day 1 event)
 *    - On the current action date, the stock formed HLC HIGHER (Day 2 event)
 *    - The status events occur back-to-back in the institutional state machine.
 * 
 * 2. BEARISH Twin Tower:
 *    - The previous HLC status event was HLC HIGHER (Day 1 event)
 *    - On the current action date, the stock formed HLC LOWER (Day 2 event)
 *    - The status events occur back-to-back in the institutional state machine.
 * 
 * 3. WEEKLY STATUS:
 *    - Evaluated across historical weekly candles to determine in which running HLC status
 *      (HLC HIGHER / HLC LOWER / NEUTRAL) the stock is currently operating.
 * 
 * HLC Higher Rule:
 * High > Prev High AND Low > Prev Low AND Close > Prev Close AND Close > Prev High
 * 
 * HLC Lower Rule:
 * High < Prev High AND Low < Prev Low AND Close < Prev Close AND Close < Prev Low
 */

// In-memory cache for rapid response
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Evaluates Twin Tower formation:
 * Using the exact state machine from StockAnalytics (which produces the table's STATUS column):
 * 1. Iterates chronologically through candles.
 * 2. Whenever a candle satisfies HLC HIGHER and currentMode !== "HLC HIGHER", mode switches to "HLC HIGHER" and status badge is recorded on that candle index.
 * 3. Whenever a candle satisfies HLC LOWER and currentMode !== "HLC LOWER", mode switches to "HLC LOWER" and status badge is recorded on that candle index.
 * 4. On the target date (Day T, index = candles.length - 1), a STATUS badge MUST have been recorded on Day T (index N-1) AND on Day T-1 (index N-2) strictly back-to-back.
 */
function evaluateTwinTower(candles, targetDateStr) {
  if (!candles || candles.length < 3) return null;

  const lastCandle = candles[candles.length - 1];
  const lastDate = typeof lastCandle.date === "string"
    ? lastCandle.date.slice(0, 10)
    : new Date(lastCandle.date).toISOString().slice(0, 10);

  if (lastDate !== targetDateStr) return null;

  const statusMap = new Map(); // idx -> 'HLC HIGHER' | 'HLC LOWER'
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
        statusMap.set(i, "HLC HIGHER");
      }
    } else if (isHlcLower) {
      if (currentMode !== "HLC LOWER") {
        currentMode = "HLC LOWER";
        statusMap.set(i, "HLC LOWER");
      }
    }
  }

  const lastIdx = candles.length - 1;
  const prevIdx = candles.length - 2;

  const stateToday = statusMap.get(lastIdx);
  const stateYesterday = statusMap.get(prevIdx);

  // Both days MUST have a visible STATUS badge (i.e. status transition) directly on Day T-1 and Day T
  if (!stateToday || !stateYesterday) return null;

  const prevCandle = candles[prevIdx];
  const prevDate = typeof prevCandle.date === "string"
    ? prevCandle.date.slice(0, 10)
    : new Date(prevCandle.date).toISOString().slice(0, 10);

  // Strictly back-to-back consecutive trading days
  if (stateYesterday === "HLC LOWER" && stateToday === "HLC HIGHER") {
    return {
      type: "BULLISH",
      twinTower: "BULLISH Twin Tower",
      isBullishTwinTower: true,
      isBearishTwinTower: false,
      day1State: "HLC LOWER",
      day2State: "HLC HIGHER",
      day1Date: formatDateOutput(prevDate),
      day2Date: formatDateOutput(lastDate),
    };
  } else if (stateYesterday === "HLC HIGHER" && stateToday === "HLC LOWER") {
    return {
      type: "BEARISH",
      twinTower: "BEARISH Twin Tower",
      isBullishTwinTower: false,
      isBearishTwinTower: true,
      day1State: "HLC HIGHER",
      day2State: "HLC LOWER",
      day1Date: formatDateOutput(prevDate),
      day2Date: formatDateOutput(lastDate),
    };
  }

  return null;
}

/**
 * Computes running Weekly Status from historical daily candles
 */
function computeWeeklyRunningStatus(dailyCandles) {
  if (!dailyCandles || dailyCandles.length < 2) return "NEUTRAL";

  const weekMap = new Map();
  for (const c of dailyCandles) {
    const d = new Date(c.date);
    if (isNaN(d.getTime())) continue;
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        date: c.date,
        open: Number(c.open) || 0,
        high: Number(c.high) || 0,
        low: Number(c.low) || 0,
        close: Number(c.close) || 0,
      });
    } else {
      const w = weekMap.get(weekKey);
      w.high = Math.max(w.high, Number(c.high) || 0);
      w.low = Math.min(w.low, Number(c.low) || 0);
      w.close = Number(c.close) || 0;
      w.date = c.date;
    }
  }

  const weeklyList = Array.from(weekMap.values());
  if (weeklyList.length < 2) return "NEUTRAL";

  let runningStatus = "NEUTRAL";
  for (let i = 1; i < weeklyList.length; i++) {
    const curr = weeklyList[i];
    const prev = weeklyList[i - 1];
    const cHigh = Number(curr.high) || 0;
    const cLow = Number(curr.low) || 0;
    const cClose = Number(curr.close) || 0;

    const pHigh = Number(prev.high) || 0;
    const pLow = Number(prev.low) || 0;
    const pClose = Number(prev.close) || 0;

    const isHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
    const isLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

    if (isHigher) {
      if (runningStatus !== "HLC HIGHER") runningStatus = "HLC HIGHER";
    } else if (isLower) {
      if (runningStatus !== "HLC LOWER") runningStatus = "HLC LOWER";
    }
  }

  return runningStatus;
}

/**
 * GET /api/dd-report
 * Run Bullish & Bearish Twin Tower Scanner
 */
export const getDdReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      filterType = "ALL", // 'ALL' | 'BULLISH' | 'BEARISH'
    } = req.query;

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve date ceiling
    let targetDate = null;
    if (actionDate && typeof actionDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(actionDate)) {
      targetDate = actionDate;
    } else {
      const [maxRes] = await pool.query(`SELECT MAX(\`date\`) as maxDate FROM \`${tableName}\``);
      targetDate = maxRes[0]?.maxDate;
    }

    const targetDateStr = targetDate
      ? typeof targetDate === "string"
        ? targetDate.slice(0, 10)
        : new Date(targetDate).toISOString().slice(0, 10)
      : null;

    if (!targetDateStr) {
      return res.status(200).json({
        success: true,
        summary: { bullishCount: 0, bearishCount: 0, totalMatched: 0, totalScanned: 0 },
        actionDate: "—",
        rawActionDate: "",
        timeframe: "Daily",
        count: 0,
        data: [],
      });
    }

    // Check cache
    const cacheKey = `${exchange}_${indice}_${targetDateStr}`;
    const cachedEntry = cache.get(cacheKey);
    let allCalculatedRecords = null;
    let baseSummary = null;

    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      allCalculatedRecords = cachedEntry.records;
      baseSummary = cachedEntry.summary;
    } else {
      // 2. Fetch symbols matching exchange & indice
      const symbolRows = await getFilteredSymbols({ exchange, indice });
      if (!symbolRows || symbolRows.length === 0) {
        return res.status(200).json({
          success: true,
          summary: { bullishCount: 0, bearishCount: 0, totalMatched: 0, totalScanned: 0 },
          actionDate: formatDateOutput(targetDateStr),
          rawActionDate: targetDateStr,
          timeframe: "Daily",
          count: 0,
          data: [],
        });
      }

      const matchedSymbols = symbolRows.map((r) => r.symbol);
      const matchedSymbolsSet = new Set(matchedSymbols);

      // 3. Query historical candles window (last 180 days is sufficient to evaluate state transitions & weekly status)
      const [allCandleRows] = await pool.query(
        `
        SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
        FROM \`${tableName}\`
        WHERE \`date\` >= DATE_SUB(?, INTERVAL 180 DAY) AND \`date\` <= ?
        ORDER BY \`symbol\` ASC, \`date\` ASC
        `,
        [targetDateStr, targetDateStr]
      );

      const candlesBySymbol = new Map();
      for (const c of allCandleRows) {
        if (!matchedSymbolsSet.has(c.symbol)) continue;
        if (!candlesBySymbol.has(c.symbol)) {
          candlesBySymbol.set(c.symbol, []);
        }
        candlesBySymbol.get(c.symbol).push(c);
      }

      allCalculatedRecords = [];
      let bullishCount = 0;
      let bearishCount = 0;

      for (const sym of matchedSymbols) {
        const cList = candlesBySymbol.get(sym) || [];
        if (cList.length < 2) continue;

        const ttRes = evaluateTwinTower(cList, targetDateStr);
        if (!ttRes) continue;

        if (ttRes.isBullishTwinTower) bullishCount++;
        if (ttRes.isBearishTwinTower) bearishCount++;

        const weeklyStatus = computeWeeklyRunningStatus(cList);
        const cleanSym = String(sym).replace(/\.(NS|BO)$/i, "");
        const latestCandle = cList[cList.length - 1];

        allCalculatedRecords.push({
          symbol: sym,
          cleanSymbol: cleanSym,
          date: formatDateOutput(targetDateStr),
          rawDate: targetDateStr,
          price: Number(latestCandle.close) || 0,
          open: Number(latestCandle.open) || 0,
          high: Number(latestCandle.high) || 0,
          low: Number(latestCandle.low) || 0,
          volume: Number(latestCandle.volume) || 0,
          weeklyStatus,
          twinTower: ttRes.twinTower,
          type: ttRes.type,
          isBullishTwinTower: ttRes.isBullishTwinTower,
          isBearishTwinTower: ttRes.isBearishTwinTower,
          day1State: ttRes.day1State,
          day2State: ttRes.day2State,
          day1Date: ttRes.day1Date,
          day2Date: ttRes.day2Date,
        });
      }

      baseSummary = {
        bullishCount,
        bearishCount,
        totalMatched: allCalculatedRecords.length,
        totalScanned: matchedSymbols.length,
      };

      cache.set(cacheKey, {
        records: allCalculatedRecords,
        summary: baseSummary,
        timestamp: Date.now(),
      });
    }

    // Filter by requested category
    let filteredRecords = allCalculatedRecords;
    const normFilter = String(filterType).toUpperCase();
    if (normFilter === "BULLISH" || normFilter === "BULLISH_DD" || normFilter === "BULLISH_TWIN_TOWER") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isBullishTwinTower);
    } else if (normFilter === "BEARISH" || normFilter === "BEARISH_DD" || normFilter === "BEARISH_TWIN_TOWER") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isBearishTwinTower);
    }

    filteredRecords.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return res.status(200).json({
      success: true,
      summary: baseSummary,
      actionDate: formatDateOutput(targetDateStr),
      rawActionDate: targetDateStr,
      timeframe: "Daily",
      filterType,
      count: filteredRecords.length,
      data: filteredRecords,
    });
  } catch (error) {
    next(error);
  }
};

export default getDdReport;
