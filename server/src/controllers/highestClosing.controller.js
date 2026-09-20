import pool from "../config/mysql.js";

/**
 * HIGHEST CLOSING INSTITUTIONAL REPORT CONTROLLER
 * Formulations matching specification:
 * 
 * 1. TYPE 1: HIGHEST CLOSING FROM 1 JAN 2026 (YTD Peak Close)
 *    - Current Close is >= all daily closes recorded since 2026-01-01
 * 
 * 2. TYPE 2: HIGHEST CLOSING FROM LIFE TIME (All-Time High / ATH Close)
 *    - Current Close is >= all daily closes recorded across the entire lifetime dataset
 * 
 * 3. SCOPE:
 *    - ONLY DAILY TIME FRAME
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
 * GET /api/highest-closing
 * Run Highest Closing Scanner (Type 1: From 1 Jan 2026 & Type 2: Lifetime ATH)
 */
export const getHighestClosingReport = async (req, res, next) => {
  try {
    const {
      exchange = "NSE",
      indice = "ALL",
      timeframe = "Daily", // Strictly Daily as per specification
      actionDate,
      filterType = "ALL", // 'ALL' | 'LIFETIME' | 'FROM_1_JAN_2026' | 'NEAR_HIGH'
      ytdStartDate = "2026-01-01",
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

    // 2. Fetch symbols matching exchange & indice
    let symQuery = `SELECT DISTINCT \`symbol\` FROM \`${tableName}\` WHERE \`symbol\` IS NOT NULL`;
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

    symQuery += " ORDER BY \`symbol\` ASC";
    const [symbolRows] = await pool.query(symQuery, symParams);

    if (!symbolRows || symbolRows.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          lifetimeAthCount: 0,
          ytdHighestCount: 0,
          nearHighCount: 0,
          totalScanned: 0,
        },
        actionDate: targetDateStr,
        timeframe: "Daily",
        ytdStartDate,
        count: 0,
        data: [],
      });
    }

    const matchedSymbols = symbolRows.map((r) => r.symbol);
    const placeholders = matchedSymbols.map(() => "?").join(",");

    // 3. Fast In-Memory Resolution
    // Fetch latest candles in window [targetDate - 10 days, targetDate]
    const [recentCandles] = await pool.query(
      `
      SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
      FROM \`${tableName}\`
      WHERE \`symbol\` IN (${placeholders})
        ${targetDateStr ? "AND `date` >= DATE_SUB(?, INTERVAL 10 DAY) AND `date` <= ?" : ""}
      ORDER BY \`symbol\` ASC, \`date\` ASC
      `,
      targetDateStr ? [...matchedSymbols, targetDateStr, targetDateStr] : [...matchedSymbols]
    );

    const latestCandleMap = new Map();
    for (const c of recentCandles) {
      latestCandleMap.set(c.symbol, c);
    }

    // 4. Fetch Max Closes: Lifetime ATH & YTD (since ytdStartDate)
    const [maxCloseRows] = await pool.query(
      `
      SELECT 
        \`symbol\`, 
        MAX(\`close\`) as lifetime_max_close,
        MAX(CASE WHEN \`date\` >= ? ${targetDateStr ? "AND `date` <= ?" : ""} THEN \`close\` ELSE NULL END) as ytd_max_close
      FROM \`${tableName}\`
      WHERE \`symbol\` IN (${placeholders})
        ${targetDateStr ? "AND `date` <= ?" : ""}
      GROUP BY \`symbol\`
      `,
      targetDateStr
        ? [ytdStartDate, targetDateStr, ...matchedSymbols, targetDateStr]
        : [ytdStartDate, ...matchedSymbols]
    );

    const maxMap = new Map();
    for (const m of maxCloseRows) {
      maxMap.set(m.symbol, m);
    }

    const reportRecords = [];
    let lifetimeAthCount = 0;
    let ytdHighestCount = 0;
    let nearHighCount = 0;

    for (const sym of matchedSymbols) {
      const candle = latestCandleMap.get(sym);
      if (!candle) continue;

      const cClose = Number(candle.close) || 0;
      const cHigh = Number(candle.high) || 0;
      const cLow = Number(candle.low) || 0;

      const maxStats = maxMap.get(sym) || {};
      const lifetimeMax = Number(maxStats.lifetime_max_close) || cClose;
      const ytdMax = Number(maxStats.ytd_max_close) || cClose;

      // Check if current close is lifetime peak (tolerance 0.01)
      const isLifetimeAth = cClose >= (lifetimeMax - 0.01);

      // Check if current close is highest since Jan 1 2026
      const isYtdHighest = cClose >= (ytdMax - 0.01);

      // Delta % from Lifetime ATH
      const deltaFromAthPercent = lifetimeMax > 0 ? Number((((cClose - lifetimeMax) / lifetimeMax) * 100).toFixed(2)) : 0;

      // Delta % from YTD Max
      const deltaFromYtdPercent = ytdMax > 0 ? Number((((cClose - ytdMax) / ytdMax) * 100).toFixed(2)) : 0;

      // Near High (within 3% of peak close)
      const isNearHigh = !isLifetimeAth && (Math.abs(deltaFromAthPercent) <= 3.0 || Math.abs(deltaFromYtdPercent) <= 3.0);

      let recordType = "STANDARD";
      let category = "standard";
      let badgeLabel = "REGULAR CLOSE";

      if (isLifetimeAth) {
        recordType = "TYPE 2: LIFETIME HIGHEST CLOSING";
        category = "lifetime_ath";
        badgeLabel = "👑 ALL TIME HIGH CLOSE (LIFETIME)";
        lifetimeAthCount++;
        ytdHighestCount++;
      } else if (isYtdHighest) {
        recordType = "TYPE 1: HIGHEST CLOSING FROM 1 JAN 2026";
        category = "ytd_peak";
        badgeLabel = "🌟 HIGHEST CLOSE FROM 1 JAN 2026";
        ytdHighestCount++;
      } else if (isNearHigh) {
        recordType = "NEAR HIGHEST CLOSING";
        category = "near_high";
        badgeLabel = "⚡ WITHIN 3% OF PEAK CLOSE";
        nearHighCount++;
      }

      // Filter
      if (filterType === "LIFETIME" && !isLifetimeAth) continue;
      if (filterType === "FROM_1_JAN_2026" && !isYtdHighest) continue;
      if (filterType === "NEAR_HIGH" && !isNearHigh) continue;

      reportRecords.push({
        symbol: candle.symbol,
        price: cClose,
        high: cHigh,
        low: cLow,
        lifetimeMaxClose: lifetimeMax,
        ytdMaxClose: ytdMax,
        isLifetimeAth,
        isYtdHighest,
        isNearHigh,
        recordType,
        category,
        badgeLabel,
        deltaFromAthPercent,
        deltaFromYtdPercent,
        date: formatDateOutput(candle.date),
        rawDate: candle.date,
      });
    }

    return res.status(200).json({
      success: true,
      summary: {
        lifetimeAthCount,
        ytdHighestCount,
        nearHighCount,
        totalScanned: matchedSymbols.length,
      },
      actionDate: formatDateOutput(targetDateStr),
      rawActionDate: targetDateStr,
      timeframe: "Daily",
      ytdStartDate,
      filterType,
      count: reportRecords.length,
      data: reportRecords,
    });
  } catch (error) {
    next(error);
  }
};
