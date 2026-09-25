import pool from "../config/mysql.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * DD (DIRECTIONAL DISTRIBUTION / BULLISH DD - BEARISH DD) REPORT CONTROLLER
 * 
 * Exact formulation matching specification:
 * 1. BULLISH DD:
 *    - DAY 1: HLC LOWER (compared to Day 0)
 *    - DAY 2: HLC HIGHER (compared to Day 1)
 * 
 * 2. BEARISH DD:
 *    - DAY 1: HLC HIGHER (compared to Day 0)
 *    - DAY 2: HLC LOWER (compared to Day 1)
 * 
 * 3. SCOPE:
 *    - FOR ALL TIME FRAME (Daily, Weekly, Monthly, Quarterly, Half-Yearly, Yearly)
 * 
 * HLC Higher Rule:
 * High > Prev High AND Low > Prev Low AND Close > Prev Close AND Close > Prev High
 * 
 * HLC Lower Rule:
 * High < Prev High AND Low < Prev Low AND Close < Prev Close AND Close < Prev Low
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
 * Aggregate daily candles into higher timeframes (Weekly, Monthly, Quarterly, Half-Yearly, Yearly)
 */
function aggregateCandles(dailyCandles, timeframe) {
  if (!dailyCandles || dailyCandles.length === 0) return [];
  if (timeframe === "Daily") return dailyCandles;

  const tfMap = new Map();

  for (const c of dailyCandles) {
    const d = new Date(c.date);
    if (isNaN(d.getTime())) continue;

    let periodKey = "";
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11

    if (timeframe === "Weekly") {
      const startOfYear = new Date(year, 0, 1);
      const weekNo = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      periodKey = `${year}-W${String(weekNo).padStart(2, "0")}`;
    } else if (timeframe === "Monthly") {
      periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    } else if (timeframe === "Quarterly") {
      const q = Math.floor(month / 3) + 1;
      periodKey = `${year}-Q${q}`;
    } else if (timeframe === "Half-Yearly") {
      const h = month < 6 ? "H1" : "H2";
      periodKey = `${year}-${h}`;
    } else if (timeframe === "Yearly") {
      periodKey = `${year}`;
    } else {
      periodKey = c.date;
    }

    if (!tfMap.has(periodKey)) {
      tfMap.set(periodKey, {
        symbol: c.symbol,
        date: c.date,
        periodKey,
        open: Number(c.open) || 0,
        high: Number(c.high) || 0,
        low: Number(c.low) || 0,
        close: Number(c.close) || 0,
        volume: Number(c.volume) || 0,
      });
    } else {
      const agg = tfMap.get(periodKey);
      agg.high = Math.max(agg.high, Number(c.high) || 0);
      agg.low = Math.min(agg.low, Number(c.low) || 0);
      agg.close = Number(c.close) || 0; // last close in period
      agg.volume += Number(c.volume) || 0;
      agg.date = c.date; // latest date in period
    }
  }

  return Array.from(tfMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Evaluates HLC Status on candle curr compared to prev
 */
function evaluateHlcState(curr, prev) {
  if (!curr || !prev) return "NONE";

  const cHigh = Number(curr.high) || 0;
  const cLow = Number(curr.low) || 0;
  const cClose = Number(curr.close) || 0;

  const pHigh = Number(prev.high) || 0;
  const pLow = Number(prev.low) || 0;
  const pClose = Number(prev.close) || 0;

  const isHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
  const isHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

  if (isHlcHigher) return "HLC HIGHER";
  if (isHlcLower) return "HLC LOWER";
  return "NEUTRAL";
}

/**
 * Evaluate Bullish DD / Bearish DD across 3 consecutive candles (Day 0, Day 1, Day 2)
 */
function evaluateDdPattern(day0, day1, day2) {
  if (!day0 || !day1 || !day2) return null;

  const day1State = evaluateHlcState(day1, day0);
  const day2State = evaluateHlcState(day2, day1);

  const isBullishDd = day1State === "HLC LOWER" && day2State === "HLC HIGHER";
  const isBearishDd = day1State === "HLC HIGHER" && day2State === "HLC LOWER";

  if (!isBullishDd && !isBearishDd) {
    return {
      isDd: false,
      ddType: "NONE",
      category: "none",
      day1State,
      day2State,
      day0,
      day1,
      day2,
    };
  }

  const d2Close = Number(day2.close) || 0;
  const d1High = Number(day1.high) || 0;
  const d1Low = Number(day1.low) || 0;

  // Margin %
  const margin = isBullishDd
    ? Number((((d2Close - d1High) / (d1High || 1)) * 100).toFixed(2))
    : Number((((d1Low - d2Close) / (d1Low || 1)) * 100).toFixed(2));

  return {
    isDd: true,
    isBullishDd,
    isBearishDd,
    ddType: isBullishDd ? "BULLISH DD" : "BEARISH DD",
    category: isBullishDd ? "bullish_dd" : "bearish_dd",
    day1State,
    day2State,
    margin,
    day0,
    day1,
    day2,
  };
}

/**
 * GET /api/dd-report
 * Run Bullish DD & Bearish DD Institutional Scanner
 */
export const getDdReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      filterType = "ALL", // 'ALL' | 'BULLISH_DD' | 'BEARISH_DD' | 'ALL_DD'
    } = req.query;

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve date ceiling
    let targetDate = actionDate;
    if (!targetDate) {
      const [maxRes] = await pool.query(`SELECT MAX(\`date\`) as maxDate FROM \`${tableName}\``);
      targetDate = maxRes[0]?.maxDate;
    }
    const targetDateStr = targetDate ? (typeof targetDate === "string" ? targetDate.slice(0, 10) : new Date(targetDate).toISOString().slice(0, 10)) : null;

    // 2. Fetch symbols matching exchange & indice
    const symbolRows = await getFilteredSymbols({ exchange, indice });

    if (!symbolRows || symbolRows.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          bullishDdCount: 0,
          bearishDdCount: 0,
          totalDdCount: 0,
          totalScanned: 0,
        },
        actionDate: targetDateStr,
        timeframe,
        count: 0,
        data: [],
      });
    }

    const matchedSymbolsSet = new Set(symbolRows.map((r) => r.symbol));

    // 3. High-Speed Date-Indexed Query (exact tight window needed to form 3 bars)
    const intervalDays = timeframe === "Yearly" ? 1150 : timeframe === "Half-Yearly" ? 580 : timeframe === "Quarterly" ? 280 : timeframe === "Monthly" ? 95 : timeframe === "Weekly" ? 35 : 15;

    const [allCandleRows] = await pool.query(
      `
      SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
      FROM \`${tableName}\`
      WHERE \`date\` >= DATE_SUB(?, INTERVAL ${intervalDays} DAY) AND \`date\` <= ?
      ORDER BY \`symbol\` ASC, \`date\` ASC
      `,
      [targetDateStr, targetDateStr]
    );

    // Group candles by symbol in-memory
    const candlesBySymbol = new Map();
    for (const c of allCandleRows) {
      if (!matchedSymbolsSet.has(c.symbol)) continue;
      if (!candlesBySymbol.has(c.symbol)) {
        candlesBySymbol.set(c.symbol, []);
      }
      candlesBySymbol.get(c.symbol).push(c);
    }

    const reportRecords = [];
    let bullishDdCount = 0;
    let bearishDdCount = 0;

    for (const sym of matchedSymbolsSet) {
      const rawList = candlesBySymbol.get(sym) || [];
      if (rawList.length < 3) continue;

      const candles = aggregateCandles(rawList, timeframe);
      if (candles.length < 3) continue;

      const day2 = candles[candles.length - 1]; // Current (Day 2)
      const day1 = candles[candles.length - 2]; // Previous (Day 1)
      const day0 = candles[candles.length - 3]; // Base (Day 0)

      const evalRes = evaluateDdPattern(day0, day1, day2);
      if (!evalRes) continue;

      if (evalRes.isBullishDd) bullishDdCount++;
      if (evalRes.isBearishDd) bearishDdCount++;

      // Filter by requested category
      if (filterType === "BULLISH_DD" && !evalRes.isBullishDd) continue;
      if (filterType === "BEARISH_DD" && !evalRes.isBearishDd) continue;
      if (filterType === "ALL_DD" && !evalRes.isBullishDd && !evalRes.isBearishDd) continue;

      reportRecords.push({
        symbol: sym,
        price: Number(day2.close) || 0,
        open: Number(day2.open) || 0,
        high: Number(day2.high) || 0,
        low: Number(day2.low) || 0,
        volume: Number(day2.volume) || 0,
        ddType: evalRes.ddType,
        category: evalRes.category,
        isBullishDd: !!evalRes.isBullishDd,
        isBearishDd: !!evalRes.isBearishDd,
        day1State: evalRes.day1State,
        day2State: evalRes.day2State,
        margin: evalRes.margin || 0,
        // Day 1 candle details
        day1Close: Number(day1.close) || 0,
        day1High: Number(day1.high) || 0,
        day1Low: Number(day1.low) || 0,
        day1Date: formatDateOutput(day1.date),
        // Day 0 candle details
        day0Close: Number(day0.close) || 0,
        day0High: Number(day0.high) || 0,
        day0Low: Number(day0.low) || 0,
        date: formatDateOutput(day2.date),
        rawDate: day2.date,
      });
    }

    return res.status(200).json({
      success: true,
      summary: {
        bullishDdCount,
        bearishDdCount,
        totalDdCount: bullishDdCount + bearishDdCount,
        totalScanned: matchedSymbolsSet.size,
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
