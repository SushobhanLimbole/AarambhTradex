import pool from "../config/mysql.js";
import { StockDataModel } from "../models/stockData.model.js";
import { getFilteredSymbols, resolveMarketTable } from "../utils/marketFilter.js";
import { calculateStrategyData, determineScenario } from "../services/strategyFormula.service.js";

/**
 * Controller for Pointer Report
 * 
 * Supports Timeframes:
 * - Daily
 * - Weekly
 * - Monthly
 * - Yearly
 * - 5-Yearly
 * 
 * Calculation Rules:
 * - Daily: Shows today's pointer scenario from today's daily candle (or target date candle).
 * - Weekly / Monthly / Yearly / 5-Yearly:
 *   If the target period ending on target date is the LAST day and COMPLETED, it shows that period's pointer.
 *   Otherwise (in-progress period), it shows the PREVIOUS completed period's pointer.
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
 * Map pointer scenario to corresponding Y, G, R trigger codes and levels:
 * - Table Top        -> Y1, G1, R1
 * - Table Tennis     -> Y2, G2, R2
 * - Rising Jack      -> Y3, G3, R3
 * - Falling Duck     -> Y5, Y2, R3
 * - Upward Rotation  -> Y1, R2, R5
 */
function getYgrTriggersForScenario(scenario, triggers) {
  const norm = String(scenario || "").trim().toUpperCase();
  const yList = triggers?.yellow || {};
  const gList = triggers?.green || {};
  const rList = triggers?.red || {};

  let t1 = { trigger: "Y1", triggerPrice: Number(yList.Y1) || 0, colorKey: "yellow" };
  let t2 = { trigger: "G1", triggerPrice: Number(gList.G1) || 0, colorKey: "green" };
  let t3 = { trigger: "R1", triggerPrice: Number(rList.R1) || 0, colorKey: "red" };

  if (norm === "TABLE TOP" || norm.includes("TABLE TOP")) {
    t1 = { trigger: "Y1", triggerPrice: Number(yList.Y1) || 0, colorKey: "yellow" };
    t2 = { trigger: "G1", triggerPrice: Number(gList.G1) || 0, colorKey: "green" };
    t3 = { trigger: "R1", triggerPrice: Number(rList.R1) || 0, colorKey: "red" };
  } else if (norm === "TABLE TENNIS") {
    t1 = { trigger: "Y2", triggerPrice: Number(yList.Y2) || 0, colorKey: "yellow" };
    t2 = { trigger: "G2", triggerPrice: Number(gList.G2) || 0, colorKey: "green" };
    t3 = { trigger: "R2", triggerPrice: Number(rList.R2) || 0, colorKey: "red" };
  } else if (norm === "RISING JACK" || norm === "BUYING POINTER") {
    t1 = { trigger: "Y3", triggerPrice: Number(yList.Y3) || 0, colorKey: "yellow" };
    t2 = { trigger: "G3", triggerPrice: Number(gList.G3) || 0, colorKey: "green" };
    t3 = { trigger: "R3", triggerPrice: Number(rList.R3) || 0, colorKey: "red" };
  } else if (norm === "FALLING DUCK" || norm === "SELLING POINTER") {
    t1 = { trigger: "Y5", triggerPrice: Number(yList.Y5 || yList.Y1) || 0, colorKey: "yellow" };
    t2 = { trigger: "Y2", triggerPrice: Number(yList.Y2 || yList.Y1) || 0, colorKey: "yellow" };
    t3 = { trigger: "R3", triggerPrice: Number(rList.R3 || rList.R1) || 0, colorKey: "red" };
  } else if (norm === "UPWARD ROTATION" || norm.includes("UPWARD")) {
    t1 = { trigger: "Y1", triggerPrice: Number(yList.Y1) || 0, colorKey: "yellow" };
    t2 = { trigger: "R2", triggerPrice: Number(rList.R2 || rList.R1) || 0, colorKey: "red" };
    t3 = { trigger: "R5", triggerPrice: Number(rList.R5 || rList.R1) || 0, colorKey: "red" };
  }

  return [t1, t2, t3];
}

/**
 * Checks if a candle period is completed as of the target action date
 */
function isPeriodCompleted(bar, timeframe, actionDateStr) {
  if (!bar) return false;
  const targetDate = new Date(actionDateStr);
  const targetDay = targetDate.getUTCDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
  const [yearStr, monthStr, dayStr] = actionDateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  switch (timeframe) {
    case "Weekly": {
      // Completed if target day is Friday/Saturday/Sunday or after the week's end date
      return targetDay >= 5 || actionDateStr > (bar.endDate || bar.date);
    }
    case "Monthly": {
      // Completed if tomorrow is a new month or after the month's end date
      const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
      return tomorrow.getUTCMonth() !== month - 1 || actionDateStr > (bar.endDate || bar.date);
    }
    case "Yearly": {
      // Completed if Dec 31 or tomorrow is new year
      const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
      return tomorrow.getUTCFullYear() !== year || actionDateStr > (bar.endDate || bar.date);
    }
    case "5-Yearly": {
      if (!bar.period && !bar.bucketKey) return false;
      const key = bar.period || bar.bucketKey;
      const parts = key.split("-").map((s) => parseInt(s, 10));
      const endYear = parts.length === 2 ? parts[1] : year;
      const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
      return (
        (year === endYear && tomorrow.getUTCFullYear() !== year) ||
        actionDateStr > (bar.endDate || bar.date)
      );
    }
    default:
      return true;
  }
}

/**
 * GET or POST /api/reports/pointer-report
 * Computes Pointer Report with timeframe aggregation & completion logic
 */
export const getPointerReport = async (req, res, next) => {
  try {
    const {
      exchange = "ALL",
      indice = "ALL",
      timeframe = "Daily",
      actionDate,
      search,
    } = { ...req.query, ...req.body };

    const normTf = String(timeframe || "Daily").trim();
    const effectiveTf = ["Daily", "Weekly", "Monthly", "Yearly", "5-Yearly"].includes(normTf)
      ? normTf
      : "Daily";

    const tableName = resolveMarketTable(exchange, indice);

    // 1. Resolve Target Date if not supplied
    let targetDateStr = actionDate ? String(actionDate).slice(0, 10) : "";
    if (!targetDateStr) {
      const [latestRow] = await pool.query(`SELECT MAX(date) as maxDate FROM \`${tableName}\``);
      targetDateStr = latestRow[0]?.maxDate
        ? new Date(latestRow[0].maxDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    }

    // 2. Fetch matched symbols based on exchange and indice
    const symbolsList = await getFilteredSymbols({ exchange, indice });
    if (!symbolsList || symbolsList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        summary: {
          totalMatched: 0,
          totalScanned: 0,
          tableTennisCount: 0,
          tableTopCount: 0,
          upwardRotationCount: 0,
          risingJackCount: 0,
          fallingDuckCount: 0,
          buyingPointerCount: 0,
          sellingPointerCount: 0,
          actionDate: targetDateStr,
          timeframe: effectiveTf,
        },
      });
    }

    const symbolNames = symbolsList.map((s) => s.symbol);

    // 3. Determine candle lookback window
    // For Daily: 60 days
    // For Weekly: 2 years
    // For Monthly: 5 years
    // For Yearly: 20 years
    // For 5-Yearly: 30 years
    let intervalSql = "INTERVAL 90 DAY";
    if (effectiveTf === "Weekly") intervalSql = "INTERVAL 2 YEAR";
    else if (effectiveTf === "Monthly") intervalSql = "INTERVAL 6 YEAR";
    else if (effectiveTf === "Yearly") intervalSql = "INTERVAL 25 YEAR";
    else if (effectiveTf === "5-Yearly") intervalSql = "INTERVAL 35 YEAR";

    // Query historical candles for matched symbols up to targetDateStr
    const candleQuery = `
      SELECT symbol, date, open, high, low, close, volume 
      FROM \`${tableName}\` 
      WHERE symbol IN (?) 
        AND date <= ? 
        AND date >= DATE_SUB(?, ${intervalSql})
      ORDER BY symbol ASC, date ASC
    `;

    const [candles] = await pool.query(candleQuery, [symbolNames, targetDateStr, targetDateStr]);

    // Group candles by symbol
    const symbolCandlesMap = new Map();
    for (const c of candles) {
      if (!symbolCandlesMap.has(c.symbol)) {
        symbolCandlesMap.set(c.symbol, []);
      }
      symbolCandlesMap.get(c.symbol).push(c);
    }

    const allRecords = [];
    let tableTennisCount = 0;
    let tableTopCount = 0;
    let upwardRotationCount = 0;
    let risingJackCount = 0;
    let fallingDuckCount = 0;

    for (const sItem of symbolsList) {
      const sym = sItem.symbol;
      const rawDaily = symbolCandlesMap.get(sym);
      if (!rawDaily || rawDaily.length === 0) continue;

      let targetCandle = null;
      let isCompleted = true;
      let periodLabel = "";

      if (effectiveTf === "Daily") {
        // Daily: latest candle <= targetDateStr
        targetCandle = rawDaily[rawDaily.length - 1];
        periodLabel = formatDateOutput(targetCandle.date);
        isCompleted = true;
      } else {
        // Higher Timeframe aggregation
        const resampled = StockDataModel.resampleCandles(rawDaily, effectiveTf);
        if (!resampled || resampled.length === 0) continue;

        const lastBar = resampled[resampled.length - 1];
        const completed = isPeriodCompleted(lastBar, effectiveTf, targetDateStr);

        if (completed || resampled.length === 1) {
          targetCandle = lastBar;
          isCompleted = completed;
          periodLabel = lastBar.period || formatDateOutput(lastBar.date);
        } else {
          // Incomplete: use previous completed period's bar
          targetCandle = resampled[resampled.length - 2];
          isCompleted = false;
          periodLabel = `${targetCandle.period || formatDateOutput(targetCandle.date)} (Prev Completed)`;
        }
      }

      if (!targetCandle) continue;

      // Calculate Strategy & Pointer
      const strat = calculateStrategyData({
        open: Number(targetCandle.open) || 0,
        high: Number(targetCandle.high) || 0,
        low: Number(targetCandle.low) || 0,
        close: Number(targetCandle.close) || 0,
      });

      let scenario = strat.conditions?.scenario || "FALSE";
      if (scenario === "FALSE" || !scenario) {
        scenario = "—";
      }

      const isTT = scenario === "Table Tennis";
      const isTop = scenario === "Table Top";
      const isUpRot = scenario === "Upward Rotation";
      const isRJ = scenario === "Rising Jack";
      const isFD = scenario === "Falling Duck";

      if (isTT) tableTennisCount++;
      if (isTop) tableTopCount++;
      if (isUpRot) upwardRotationCount++;
      if (isRJ) risingJackCount++;
      if (isFD) fallingDuckCount++;

      const latestDaily = rawDaily[rawDaily.length - 1];
      const cleanSym = String(sym).replace(/^\^/, "").replace(/^DELTAIN:/i, "").replace(/\.(NS|BO)$/i, "");
      const rangeVal = strat.calcs?.range !== undefined ? Number(strat.calcs.range.toFixed(2)) : 0;
      const avgVal = strat.calcs?.average !== undefined ? Number(strat.calcs.average.toFixed(2)) : 0;

      allRecords.push({
        symbol: sym,
        cleanSymbol: cleanSym,
        companyName: sItem.company_name || "",
        indice: sItem.indice || "",
        exchange: sItem.exchange || "NSE",
        timeframe: effectiveTf,
        targetDate: formatDateOutput(targetCandle.date || targetCandle.endDate),
        rawDate: targetCandle.date || targetCandle.endDate,
        periodLabel,
        isCompletedPeriod: isCompleted,
        price: Number(latestDaily.close) || 0,
        open: Number(targetCandle.open) || 0,
        high: Number(targetCandle.high) || 0,
        low: Number(targetCandle.low) || 0,
        close: Number(targetCandle.close) || 0,
        range: rangeVal,
        average: avgVal,
        pointer: scenario,
        isTableTennis: isTT,
        isTableTop: isTop,
        isUpwardRotation: isUpRot,
        isRisingJack: isRJ,
        isFallingDuck: isFD,
        isBuyingPointer: isRJ,
        isSellingPointer: isFD,
        ygrTriggers: getYgrTriggersForScenario(scenario, strat.triggers),
        triggers: strat.triggers,
      });
    }

    // Sort by symbol ascending
    allRecords.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return res.status(200).json({
      success: true,
      data: allRecords,
      summary: {
        totalMatched: allRecords.length,
        totalScanned: symbolsList.length,
        tableTennisCount,
        tableTopCount,
        upwardRotationCount,
        risingJackCount,
        fallingDuckCount,
        buyingPointerCount: risingJackCount,
        sellingPointerCount: fallingDuckCount,
        actionDate: targetDateStr,
        timeframe: effectiveTf,
      },
    });
  } catch (error) {
    console.error("[PointerReportController] Error generating Pointer Report:", error);
    next(error);
  }
};
