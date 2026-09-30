import pool from "../config/mysql.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";

/**
 * HIGHEST CLOSING INSTITUTIONAL REPORT CONTROLLER
 * 
 * Logic & Specifications:
 * 1. Initial 6-Month Listing Baseline Rule:
 *    - The 6-month baseline ONLY applies to the first 6 months of a stock after its initial listing.
 *      (e.g., if TCS listed in Jan 1999, Jan–Jun 1999 establishes initial max/min close baseline).
 * 
 * 2. Type 1: ATH / ATL (Lifetime) Report:
 *    - After first 6 months from listing: Each trading day is evaluated.
 *      If close > athThreshold: athCount++, athThreshold = close.
 *      If close < atlThreshold: atlCount++, atlThreshold = close.
 *      If close crossed threshold on actionDate, stock qualifies for ATH / ATL today.
 * 
 * 3. Type 2: CYATH / CYATL (Current Year) Report:
 *    - In subsequent years (once past the initial listing baseline):
 *      CYATH / CYATL tracks new highs / lows from day 1 of the current year (no 6-month wait).
 *      If close > cyathThreshold: cyathCount++, cyathThreshold = close.
 *      If close < cyatlThreshold: cyatlCount++, cyatlThreshold = close.
 *      If close crossed threshold on actionDate, stock qualifies for CYATH / CYATL today.
 * 
 * 4. Scope & Filtering:
 *    - ONLY DAILY TIME FRAME
 *    - Stocks that have NOT crossed any threshold on the target action date are excluded.
 */

// In-memory cache for fast response on repeated filters
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
 * GET /api/highest-closing
 * Run Highest Closing Scanner (Type 1: Lifetime ATH/ATL & Type 2: CYATH/CYATL)
 */
export const getHighestClosingReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      filterType = "ALL", // 'ALL' | 'ATH' | 'CYATH' | 'ATL' | 'CYATL'
    } = req.query;

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve target date
    let targetDate = actionDate;
    if (!targetDate) {
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
        summary: { athCount: 0, atlCount: 0, cyathCount: 0, cyatlCount: 0, totalQualified: 0, totalScanned: 0 },
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
    let totalScanned = 0;

    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      allCalculatedRecords = cachedEntry.records;
      baseSummary = cachedEntry.summary;
      totalScanned = cachedEntry.totalScanned;
    } else {
      // 2. Fetch symbols matching exchange & indice
      const symbolRows = await getFilteredSymbols({ exchange, indice });
      if (!symbolRows || symbolRows.length === 0) {
        return res.status(200).json({
          success: true,
          summary: { athCount: 0, atlCount: 0, cyathCount: 0, cyatlCount: 0, totalQualified: 0, totalScanned: 0 },
          actionDate: formatDateOutput(targetDateStr),
          rawActionDate: targetDateStr,
          timeframe: "Daily",
          count: 0,
          data: [],
        });
      }

      const matchedSymbols = symbolRows.map((r) => r.symbol);
      const matchedSet = new Set(matchedSymbols);
      totalScanned = matchedSymbols.length;

      // 1. Fetch candles for targetDate to find active traded symbols
      const [todayCandleRows] = await pool.query(
        `
        SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
        FROM \`${tableName}\`
        WHERE \`date\` = ?
        `,
        [targetDateStr]
      );

      const activeTodayCandles = todayCandleRows.filter((c) => matchedSet.has(c.symbol));
      const activeSymbols = activeTodayCandles.map((c) => c.symbol);
      const activeCandleMap = new Map();
      activeTodayCandles.forEach((c) => activeCandleMap.set(c.symbol, c));

      const targetYear = new Date(targetDateStr).getFullYear();
      const yearStartStr = `${targetYear}-01-01`;

      allCalculatedRecords = [];
      let athCount = 0;
      let atlCount = 0;
      let cyathCount = 0;
      let cyatlCount = 0;

      // 2. Stage 1: Ultra-Fast Current-Year Aggregation (Scans only ~400k rows instead of 13.5M rows)
      // Mathematically, any stock hitting ATH/CYATH today MUST exceed its previous maximum close in the current year.
      // Similarly, any stock hitting ATL/CYATL today MUST drop below its previous minimum close in the current year.
      const [yearAggRows] = await pool.query(
        `
        SELECT \`symbol\`,
               MAX(\`close\`) as prevMaxYear,
               MIN(\`close\`) as prevMinYear
        FROM \`${tableName}\`
        WHERE \`date\` >= ? AND \`date\` < ?
        GROUP BY \`symbol\`
        `,
        [yearStartStr, targetDateStr]
      );

      const yearAggMap = new Map();
      for (const r of yearAggRows) {
        yearAggMap.set(r.symbol, r);
      }

      // Identify candidates that crossed current-year extremes or have no prior data this year (e.g., IPO)
      const qualifiedCandidateSymbols = [];
      for (const sym of activeSymbols) {
        const today = activeCandleMap.get(sym);
        if (!today) continue;

        const yAgg = yearAggMap.get(sym);
        // If stock has no prior trading days in the current year
        if (!yAgg) {
          qualifiedCandidateSymbols.push(sym);
          continue;
        }

        const close = Number(today.close);
        const isYearHigh = yAgg.prevMaxYear !== null && close > Number(yAgg.prevMaxYear);
        const isYearLow = yAgg.prevMinYear !== null && close < Number(yAgg.prevMinYear);

        if (isYearHigh || isYearLow) {
          qualifiedCandidateSymbols.push(sym);
        }
      }

      // 3. Stage 2: Fetch full historical candles ONLY for qualified candidate symbols to compute exact counts and records
      if (qualifiedCandidateSymbols.length > 0) {
        const qPlaceholders = qualifiedCandidateSymbols.map(() => "?").join(",");
        const [candidateCandles] = await pool.query(
          `
          SELECT \`symbol\`, \`date\`, \`close\`
          FROM \`${tableName}\`
          WHERE \`symbol\` IN (${qPlaceholders}) AND \`date\` <= ?
          ORDER BY \`symbol\` ASC, \`date\` ASC
          `,
          [...qualifiedCandidateSymbols, targetDateStr]
        );

        const bySym = new Map();
        for (const c of candidateCandles) {
          if (!bySym.has(c.symbol)) bySym.set(c.symbol, []);
          bySym.get(c.symbol).push(c);
        }

        for (const [sym, cList] of bySym.entries()) {
          if (!cList || cList.length === 0) continue;

          // 1. Lifetime ATH & ATL Calculation (with 6-Month baseline rule)
          const firstDate = new Date(cList[0].date);
          const sixMonthsLater = new Date(firstDate);
          sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
          const sixMonthsStr = sixMonthsLater.toISOString().slice(0, 10);

          let athThreshold = -Infinity;
          let atlThreshold = Infinity;
          let totalAthCount = 0;
          let totalAtlCount = 0;
          let isAthToday = false;
          let isAtlToday = false;

          for (const c of cList) {
            const dStr = typeof c.date === "string" ? c.date.slice(0, 10) : new Date(c.date).toISOString().slice(0, 10);
            const close = Number(c.close);
            if (dStr <= sixMonthsStr) {
              if (close > athThreshold) athThreshold = close;
              if (close < atlThreshold) atlThreshold = close;
            } else {
              if (close > athThreshold) {
                totalAthCount++;
                athThreshold = close;
                if (dStr === targetDateStr) isAthToday = true;
              }
              if (close < atlThreshold) {
                totalAtlCount++;
                atlThreshold = close;
                if (dStr === targetDateStr) isAtlToday = true;
              }
            }
          }

          // 2. Current Year CYATH & CYATL Calculation (Full Current Year tracking, respecting initial listing baseline if new stock)
          let cyathThreshold = -Infinity;
          let cyatlThreshold = Infinity;
          let totalCyathCount = 0;
          let totalCyatlCount = 0;
          let isCyathToday = false;
          let isCyatlToday = false;

          for (const c of cList) {
            const dStr = typeof c.date === "string" ? c.date.slice(0, 10) : new Date(c.date).toISOString().slice(0, 10);
            if (dStr < yearStartStr) continue;
            const close = Number(c.close);

            // If stock is still within its initial 6 months from listing in the current year
            if (dStr <= sixMonthsStr) {
              if (close > cyathThreshold) cyathThreshold = close;
              if (close < cyatlThreshold) cyatlThreshold = close;
            } else {
              if (cyathThreshold === -Infinity) {
                // First trading day of current year initializes the threshold
                cyathThreshold = close;
                cyatlThreshold = close;
              } else {
                if (close > cyathThreshold) {
                  totalCyathCount++;
                  cyathThreshold = close;
                  if (dStr === targetDateStr) isCyathToday = true;
                }
                if (close < cyatlThreshold) {
                  totalCyatlCount++;
                  cyatlThreshold = close;
                  if (dStr === targetDateStr) isCyatlToday = true;
                }
              }
            }
          }

          // 3. Qualification: Stock must have crossed ATH, ATL, CYATH, or CYATL on targetDateStr
          if (isAthToday || isAtlToday || isCyathToday || isCyatlToday) {
            if (isAthToday) athCount++;
            if (isAtlToday) atlCount++;
            if (isCyathToday) cyathCount++;
            if (isCyatlToday) cyatlCount++;

            const latestCandle = activeCandleMap.get(sym) || cList[cList.length - 1];
            const cleanSym = String(sym).replace(/\.(NS|BO)$/i, "");

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
              isAthToday,
              isAtlToday,
              isCyathToday,
              isCyatlToday,
              ath: {
                value: athThreshold !== -Infinity ? Number(athThreshold.toFixed(2)) : null,
                count: totalAthCount,
                isToday: isAthToday,
              },
              atl: {
                value: atlThreshold !== Infinity ? Number(atlThreshold.toFixed(2)) : null,
                count: totalAtlCount,
                isToday: isAtlToday,
              },
              cyath: {
                value: cyathThreshold !== -Infinity ? Number(cyathThreshold.toFixed(2)) : null,
                count: totalCyathCount,
                isToday: isCyathToday,
              },
              cyatl: {
                value: cyatlThreshold !== Infinity ? Number(cyatlThreshold.toFixed(2)) : null,
                count: totalCyatlCount,
                isToday: isCyatlToday,
              },
            });
          }
        }
      }

      baseSummary = {
        athCount,
        atlCount,
        cyathCount,
        cyatlCount,
        totalQualified: allCalculatedRecords.length,
        totalScanned,
      };

      // Save to cache
      cache.set(cacheKey, {
        records: allCalculatedRecords,
        summary: baseSummary,
        totalScanned,
        timestamp: Date.now(),
      });
    }

    // Filter by requested report type
    let filteredRecords = allCalculatedRecords;
    const normFilter = String(filterType).toUpperCase();
    if (normFilter === "TYPE1" || normFilter === "ATH" || normFilter === "LIFETIME") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isAthToday || r.isAtlToday);
    } else if (normFilter === "TYPE2" || normFilter === "CYATH" || normFilter === "CURRENT_YEAR") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isCyathToday || r.isCyatlToday);
    } else if (normFilter === "ATH_ONLY") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isAthToday);
    } else if (normFilter === "ATL_ONLY") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isAtlToday);
    } else if (normFilter === "CYATH_ONLY") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isCyathToday);
    } else if (normFilter === "CYATL_ONLY") {
      filteredRecords = allCalculatedRecords.filter((r) => r.isCyatlToday);
    }

    // Sort alphabetically by symbol
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
