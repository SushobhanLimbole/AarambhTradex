import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * TWIN TOWER (DIRECTIONAL SHIFT) REPORT CONTROLLER
 * 
 * Exact formulation matching specification:
 * 1. BULLISH Twin Tower:
 *    - The previous HLC status event was HLC LOWER (Period 1 event)
 *    - On the current action date/period, the stock formed HLC HIGHER (Period 2 event)
 *    - The status events occur back-to-back in the institutional state machine.
 * 
 * 2. BEARISH Twin Tower:
 *    - The previous HLC status event was HLC HIGHER (Period 1 event)
 *    - On the current action date/period, the stock formed HLC LOWER (Period 2 event)
 *    - The status events occur back-to-back in the institutional state machine.
 * 
 * 3. HIERARCHICAL COMPARISON STATUS:
 *    - Daily      -> Weekly (Evaluates running status of previous week)
 *    - Weekly     -> Monthly (Evaluates running status of previous month)
 *    - Monthly    -> Yearly (Evaluates running status of previous year)
 *    - Yearly     -> 5-Yearly (Evaluates running status of previous 5-yearly)
 * 
 * HLC Higher Rule:
 * High > Prev High AND Low > Prev Low AND Close > Prev Close AND Close > Prev High
 * 
 * HLC Lower Rule:
 * High < Prev High AND Low < Prev Low AND Close < Prev Close AND Close < Prev Low
 */

const HTF_MAP = {
  Daily: "Weekly",
  Weekly: "Monthly",
  Monthly: "Yearly",
  Yearly: "5-Yearly",
};

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
 * Evaluates Twin Tower formation across the specified timeframe candles:
 * 1. Iterates chronologically through candles.
 * 2. Whenever a candle satisfies HLC HIGHER and currentMode !== "HLC HIGHER", mode switches to "HLC HIGHER" and status badge is recorded on that candle index.
 * 3. Whenever a candle satisfies HLC LOWER and currentMode !== "HLC LOWER", mode switches to "HLC LOWER" and status badge is recorded on that candle index.
 * 4. On the target period (Day/Period T, index = candles.length - 1), a STATUS badge MUST have been recorded on Period T (index N-1) AND on Period T-1 (index N-2) strictly back-to-back.
 */
function evaluateTwinTower(candles, targetDateStr, timeframe = "Daily") {
  if (!candles || candles.length < 3) return null;

  const lastCandle = candles[candles.length - 1];
  const lastDate = typeof lastCandle.date === "string"
    ? lastCandle.date.slice(0, 10)
    : new Date(lastCandle.date).toISOString().slice(0, 10);

  if (timeframe === "Daily" && lastDate !== targetDateStr) return null;

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

  // Both periods MUST have a visible STATUS badge (i.e. status transition) directly on Period T-1 and Period T
  if (!stateToday || !stateYesterday) return null;

  const prevCandle = candles[prevIdx];
  const prevDate = typeof prevCandle.date === "string"
    ? prevCandle.date.slice(0, 10)
    : new Date(prevCandle.date).toISOString().slice(0, 10);

  // Strictly back-to-back consecutive periods
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
      rawDay1Date: prevDate,
      rawDay2Date: lastDate,
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
      rawDay1Date: prevDate,
      rawDay2Date: lastDate,
    };
  }

  return null;
}

/**
 * Computes running status from historical higher timeframe candles:
 * - For Daily -> evaluate Weekly candles of previous weeks
 * - For Weekly -> evaluate Monthly candles of previous months
 * - For Monthly -> evaluate Yearly candles of previous years
 * - For Yearly -> evaluate 5-Yearly candles of previous 5-year periods
 */
function computeHigherTimeframeStatus(dailyCandles, targetTf, higherTf, targetDateStr) {
  if (!dailyCandles || dailyCandles.length < 2) return "NEUTRAL";

  const htfList = StockDataModel.resampleCandles(dailyCandles, higherTf);
  if (!htfList || htfList.length < 2) return "NEUTRAL";

  // Find the higher timeframe bar that contains the targetDateStr
  // We want to evaluate running status up to the PREVIOUS completed higher timeframe bar
  let cutoffIdx = htfList.length - 1;

  for (let i = htfList.length - 1; i >= 0; i--) {
    const bar = htfList[i];
    const sDate = bar.startDate || bar.date;
    const eDate = bar.endDate || bar.date;
    if (targetDateStr >= sDate && targetDateStr <= eDate) {
      cutoffIdx = i;
      break;
    }
  }

  // Take all bars strictly prior to the current active higher timeframe bar
  const previousHtfBars = htfList.slice(0, cutoffIdx);
  const evalList = previousHtfBars.length >= 2 ? previousHtfBars : htfList;

  let runningStatus = "NEUTRAL";
  for (let i = 1; i < evalList.length; i++) {
    const curr = evalList[i];
    const prev = evalList[i - 1];
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

    const normTf = String(timeframe).trim();
    const effectiveTf = ["Daily", "Weekly", "Monthly", "Yearly"].includes(normTf) ? normTf : "Daily";
    const higherTf = HTF_MAP[effectiveTf] || "Weekly";

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
        timeframe: effectiveTf,
        higherTimeframe: higherTf,
        count: 0,
        data: [],
      });
    }

    // Check cache
    const cacheKey = `${exchange}_${indice}_${effectiveTf}_${targetDateStr}`;
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
          timeframe: effectiveTf,
          higherTimeframe: higherTf,
          count: 0,
          data: [],
        });
      }

      const matchedSymbols = symbolRows.map((r) => r.symbol);
      const isFilteredSubset = matchedSymbols.length < 1500;

      // Determine lookback window depending on timeframe
      let intervalSql = "INTERVAL 180 DAY";
      if (effectiveTf === "Weekly") intervalSql = "INTERVAL 2 YEAR";
      if (effectiveTf === "Monthly") intervalSql = "INTERVAL 5 YEAR";
      if (effectiveTf === "Yearly") intervalSql = "INTERVAL 15 YEAR";

      // 3. Query historical candles window with direct date selection & indexing
      let query = "";
      let params = [];

      if (isFilteredSubset) {
        query = `
          SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
          FROM \`${tableName}\`
          WHERE \`symbol\` IN (?) AND \`date\` >= DATE_SUB(?, ${intervalSql}) AND \`date\` <= ?
          ORDER BY \`symbol\` ASC, \`date\` ASC
        `;
        params = [matchedSymbols, targetDateStr, targetDateStr];
      } else {
        query = `
          SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
          FROM \`${tableName}\`
          WHERE \`date\` >= DATE_SUB(?, ${intervalSql}) AND \`date\` <= ?
          ORDER BY \`symbol\` ASC, \`date\` ASC
        `;
        params = [targetDateStr, targetDateStr];
      }

      const [allCandleRows] = await pool.query(query, params);

      const matchedSymbolsSet = new Set(matchedSymbols);
      const candlesBySymbol = new Map();
      for (const c of allCandleRows) {
        if (!matchedSymbolsSet.has(c.symbol)) continue;
        if (!candlesBySymbol.has(c.symbol)) {
          candlesBySymbol.set(c.symbol, []);
        }
        // Normalize date format quickly
        if (c.date instanceof Date) {
          c.date = c.date.toISOString().slice(0, 10);
        } else if (typeof c.date === "string") {
          c.date = c.date.slice(0, 10);
        }
        candlesBySymbol.get(c.symbol).push(c);
      }

      allCalculatedRecords = [];
      let bullishCount = 0;
      let bearishCount = 0;

      for (const sym of matchedSymbols) {
        const cList = candlesBySymbol.get(sym) || [];
        if (cList.length < 2) continue;

        // For Daily, if the stock didn't trade on targetDate, skip directly
        if (effectiveTf === "Daily") {
          const lastCandle = cList[cList.length - 1];
          const lastDateStr = typeof lastCandle.date === "string" ? lastCandle.date.slice(0, 10) : new Date(lastCandle.date).toISOString().slice(0, 10);
          if (lastDateStr !== targetDateStr) continue;
        }

        // Resample candles according to requested timeframe
        const tfCandles = effectiveTf === "Daily" ? cList : StockDataModel.resampleCandles(cList, effectiveTf);
        if (tfCandles.length < 2) continue;

        const ttRes = evaluateTwinTower(tfCandles, targetDateStr, effectiveTf);
        if (!ttRes) continue;

        if (ttRes.isBullishTwinTower) bullishCount++;
        if (ttRes.isBearishTwinTower) bearishCount++;

        const weeklyStatus = computeHigherTimeframeStatus(cList, effectiveTf, higherTf, targetDateStr);
        const cleanSym = String(sym).replace(/^\^/, "").replace(/\.(NS|BO)$/i, "");
        const latestCandle = tfCandles[tfCandles.length - 1];

        allCalculatedRecords.push({
          symbol: sym,
          cleanSymbol: cleanSym,
          date: formatDateOutput(ttRes.rawDay2Date || targetDateStr),
          rawDate: ttRes.rawDay2Date || targetDateStr,
          price: Number(latestCandle.close) || 0,
          open: Number(latestCandle.open) || 0,
          high: Number(latestCandle.high) || 0,
          low: Number(latestCandle.low) || 0,
          volume: Number(latestCandle.volume) || 0,
          timeframe: effectiveTf,
          higherTimeframe: higherTf,
          weeklyStatus, // HTF running status
          twinTower: ttRes.twinTower,
          type: ttRes.type,
          isBullishTwinTower: ttRes.isBullishTwinTower,
          isBearishTwinTower: ttRes.isBearishTwinTower,
          day1State: ttRes.day1State,
          day2State: ttRes.day2State,
          day1Date: ttRes.day1Date,
          day2Date: ttRes.day2Date,
          rawDay1Date: ttRes.rawDay1Date,
          rawDay2Date: ttRes.rawDay2Date,
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
      timeframe: effectiveTf,
      higherTimeframe: higherTf,
      filterType,
      count: filteredRecords.length,
      data: filteredRecords,
    });
  } catch (error) {
    next(error);
  }
};

export default getDdReport;
