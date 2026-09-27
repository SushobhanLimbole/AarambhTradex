import YahooFinance from "yahoo-finance2";
import pool from "../config/mysql.js";
import { defaultRateLimiter } from "./rateLimiter.js";
import { isIndianMarketHoliday, isPhantomOrUnopenedCandle } from "../utils/holidayUtils.js";

const yahooFinance = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

export const GLOBAL_TARGET_ASSETS = [
  { symbol: "BTC-USD", exchange: "CRYPTO", indice: "Crypto", name: "Bitcoin USD" },
  { symbol: "ETH-USD", exchange: "CRYPTO", indice: "Crypto", name: "Ethereum USD" },
  { symbol: "SOL-USD", exchange: "CRYPTO", indice: "Crypto", name: "Solana USD" },
  { symbol: "XRP-USD", exchange: "CRYPTO", indice: "Crypto", name: "XRP USD" },
  { symbol: "XAUUSD=X", exchange: "METALS", indice: "Metals", name: "Gold Spot (USD)" },
  { symbol: "XAGUSD=X", exchange: "METALS", indice: "Metals", name: "Silver Spot (USD)" },
];

/**
 * Format a Date or date string to YYYY-MM-DD
 */
export function formatDateStr(dateInput) {
  if (!dateInput) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof dateInput === "string") {
    return dateInput.slice(0, 10);
  }
  return dateInput.toISOString().slice(0, 10);
}

/**
 * Resolves a symbol into a valid Yahoo Finance ticker symbol
 */
export function resolveYahooSymbol(symbol, exchange) {
  if (!symbol) return "";
  const s = String(symbol).trim().toUpperCase();

  // Spot metals map to Yahoo liquid futures
  if (s === "XAUUSD=X" || s === "XAU-USD") return "GC=F";
  if (s === "XAGUSD=X" || s === "XAG-USD") return "SI=F";

  // Index symbols, currency pairs, or crypto pairs already formatted
  if (s.startsWith("^") || s.includes("=") || s.includes("-")) {
    return s;
  }
  // Already has .NS or .BO suffix
  if (s.endsWith(".NS") || s.endsWith(".BO")) {
    return s;
  }
  // Indian exchange routing
  if (String(exchange).toUpperCase() === "BSE") {
    return `${s}.BO`;
  }
  return `${s}.NS`;
}

/**
 * ============================================================================
 * 1. INDIAN MARKET EOD INGESTION (NSE & BSE)
 * ============================================================================
 * Fetches today's daily candles for active Indian equities and upserts into MySQL.
 */
export async function syncIndianEOD(options = {}) {
  const startTime = Date.now();
  const targetDateStr = formatDateStr(options.date);
  console.log(
    `[EODSync] [${new Date().toISOString()}] Starting Indian Market EOD sync for date: ${targetDateStr}...`
  );

  // Check if target date is an Indian market holiday / weekend closure
  const holidayCheck = isIndianMarketHoliday(targetDateStr);
  if (!options.force && holidayCheck.isHoliday) {
    console.log(
      `[EODSync] [${new Date().toISOString()}] 🏖️ Target date ${targetDateStr} is a market holiday / closed (${holidayCheck.reason}). Skipping Indian EOD sync.`
    );
    return {
      success: true,
      market: "INDIAN",
      targetDate: targetDateStr,
      skipped: true,
      reason: holidayCheck.reason,
      totalSymbols: 0,
      syncedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      recoveredCount: 0,
      retryPassesRun: 0,
      durationMs: Date.now() - startTime,
      failedSymbols: [],
    };
  }

  // 1. Fetch active symbols from symbols table (or historical_candles fallback)
  let symbols = [];
  try {
    const [symbolRows] = await pool.query(
      `SELECT symbol, exchange FROM symbols WHERE exchange IN ('NSE', 'BSE') ORDER BY symbol ASC`
    );
    if (symbolRows && symbolRows.length > 0) {
      symbols = symbolRows;
    } else {
      const [candleSymbols] = await pool.query(
        `SELECT DISTINCT symbol FROM historical_candles ORDER BY symbol ASC`
      );
      symbols = candleSymbols;
    }
  } catch (dbErr) {
    console.error(`[EODSync] Error fetching symbol list from database:`, dbErr.message);
    throw dbErr;
  }

  if (options.limit && !isNaN(Number(options.limit))) {
    symbols = symbols.slice(0, Number(options.limit));
  }

  console.log(
    `[EODSync] [${new Date().toISOString()}] Found ${symbols.length} Indian equity symbols to process.`
  );

  defaultRateLimiter.clearFailedQueue();
  let syncedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const candleBatch = [];
  const batchSize = 100;

  const targetDateObj = new Date(targetDateStr);
  const period1 = new Date(targetDateObj.getTime() - 2 * 86400000); // 2 days buffer
  const period2 = new Date(targetDateObj.getTime() + 1 * 86400000); // next day

  for (let i = 0; i < symbols.length; i++) {
    const symObj = symbols[i];
    const ySymbol = resolveYahooSymbol(symObj.symbol, symObj.exchange);

    try {
      const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
        return await yahooFinance.historical(ySymbol, {
          period1,
          period2,
          interval: "1d",
        });
      }, ySymbol);

      if (!rawCandles || rawCandles.length === 0) {
        skippedCount++;
        continue;
      }

      // Find the candle matching the targetDateStr or latest available
      let matchedCandle = rawCandles.find(
        (c) => formatDateStr(c.date) === targetDateStr
      );
      if (!matchedCandle) {
        matchedCandle = rawCandles[rawCandles.length - 1];
      }

      // Check if candle is a forward-fill / unopened phantom candle (flat price + 0 volume)
      if (matchedCandle && !isPhantomOrUnopenedCandle(matchedCandle)) {
        candleBatch.push([
          symObj.symbol,
          formatDateStr(matchedCandle.date),
          Number(matchedCandle.open.toFixed(4)),
          Number(matchedCandle.high.toFixed(4)),
          Number(matchedCandle.low.toFixed(4)),
          Number(matchedCandle.close.toFixed(4)),
          matchedCandle.volume !== undefined && matchedCandle.volume !== null && !isNaN(Number(matchedCandle.volume))
            ? Number(matchedCandle.volume)
            : 0,
        ]);
        syncedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      failedCount++;
      // Rate limiter logs error, loop continues without crashing
    }

    // Flush batch to database
    if (candleBatch.length >= batchSize) {
      await bulkUpsertHistoricalCandles(candleBatch.splice(0, candleBatch.length));
    }

    if ((i + 1) % 100 === 0 || i === symbols.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[EODSync] [${new Date().toISOString()}] Progress: ${i + 1}/${symbols.length} processed (${syncedCount} synced, ${failedCount} failed, ${skippedCount} skipped) in ${elapsed}s`
      );
    }
  }

  // Flush remaining batch from Pass 1
  if (candleBatch.length > 0) {
    await bulkUpsertHistoricalCandles(candleBatch.splice(0, candleBatch.length));
  }

  // Multi-pass retry for rate-limited or transiently failed symbols
  const maxRetryPasses = options.maxRetryPasses !== undefined ? options.maxRetryPasses : 2;
  let retryPass = 0;
  let totalRecovered = 0;

  while (retryPass < maxRetryPasses) {
    const retryable = defaultRateLimiter.getRetryableFailedQueue();
    if (!retryable || retryable.length === 0) break;

    retryPass++;
    const cooldownSec = 30 * retryPass;
    console.warn(
      `[EODSync] [${new Date().toISOString()}] ⚠️ Rate limit/network recovery: Found ${retryable.length} retryable failed symbols. Entering ${cooldownSec}s cooldown before Retry Pass ${retryPass}/${maxRetryPasses}...`
    );
    await new Promise((resolve) => setTimeout(resolve, cooldownSec * 1000));

    const retrySymbolSet = new Set(retryable.map((r) => r.identifier));
    const symbolsToRetry = symbols.filter((s) => {
      const ySym = resolveYahooSymbol(s.symbol, s.exchange);
      return retrySymbolSet.has(ySym) || retrySymbolSet.has(s.symbol);
    });

    defaultRateLimiter.clearFailedQueue();
    let recoveredInPass = 0;

    for (let i = 0; i < symbolsToRetry.length; i++) {
      const symObj = symbolsToRetry[i];
      const ySymbol = resolveYahooSymbol(symObj.symbol, symObj.exchange);

      try {
        const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
          return await yahooFinance.historical(ySymbol, {
            period1,
            period2,
            interval: "1d",
          });
        }, ySymbol);

        if (rawCandles && rawCandles.length > 0) {
          let matchedCandle = rawCandles.find(
            (c) => formatDateStr(c.date) === targetDateStr
          ) || rawCandles[rawCandles.length - 1];

          if (matchedCandle && !isPhantomOrUnopenedCandle(matchedCandle)) {
            candleBatch.push([
              symObj.symbol,
              formatDateStr(matchedCandle.date),
              Number(matchedCandle.open.toFixed(4)),
              Number(matchedCandle.high.toFixed(4)),
              Number(matchedCandle.low.toFixed(4)),
              Number(matchedCandle.close.toFixed(4)),
              matchedCandle.volume !== undefined && matchedCandle.volume !== null && !isNaN(Number(matchedCandle.volume))
                ? Number(matchedCandle.volume)
                : 0,
            ]);
            recoveredInPass++;
            totalRecovered++;
            syncedCount++;
            failedCount = Math.max(0, failedCount - 1);
          }
        }
      } catch (err) {
        // Still failed; logged in rateLimiter.failedQueue for potential next pass
      }

      if (candleBatch.length >= batchSize) {
        await bulkUpsertHistoricalCandles(candleBatch.splice(0, candleBatch.length));
      }
    }

    if (candleBatch.length > 0) {
      await bulkUpsertHistoricalCandles(candleBatch.splice(0, candleBatch.length));
    }

    console.log(
      `[EODSync] [${new Date().toISOString()}] Retry Pass ${retryPass} completed. Recovered ${recoveredInPass}/${symbolsToRetry.length} symbols.`
    );
  }

  const durationMs = Date.now() - startTime;
  const failedQueue = defaultRateLimiter.getFailedQueue();

  console.log(
    `[EODSync] [${new Date().toISOString()}] Finished Indian Market EOD sync in ${(durationMs / 1000).toFixed(1)}s. Total Synced: ${syncedCount} (Recovered: ${totalRecovered}), Failed: ${failedCount}, Skipped: ${skippedCount}.`
  );

  return {
    success: true,
    market: "INDIAN",
    targetDate: targetDateStr,
    totalSymbols: symbols.length,
    syncedCount,
    failedCount,
    skippedCount,
    recoveredCount: totalRecovered,
    retryPassesRun: retryPass,
    durationMs,
    failedSymbols: failedQueue.slice(0, 50),
  };
}

/**
 * Bulk Upsert into historical_candles
 */
async function bulkUpsertHistoricalCandles(records) {
  if (!records || records.length === 0) return;
  const query = `
    INSERT INTO historical_candles (symbol, date, open, high, low, close, volume)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      open = VALUES(open),
      high = VALUES(high),
      low = VALUES(low),
      close = VALUES(close),
      volume = VALUES(volume)
  `;
  await pool.query(query, [records]);
}

/**
 * ============================================================================
 * 2. GLOBAL ASSETS EOD INGESTION (CRYPTO & SPOT METALS)
 * ============================================================================
 * Fetches latest settled daily candles for BTC-USD, ETH-USD, XAUUSD=X, etc.
 */
export async function syncGlobalEOD(options = {}) {
  const startTime = Date.now();
  const targetDateStr = formatDateStr(options.date);
  console.log(
    `[EODSync] [${new Date().toISOString()}] Starting Global Assets EOD sync (Crypto & Metals)...`
  );

  const assets = GLOBAL_TARGET_ASSETS;
  const candleBatch = [];
  let syncedCount = 0;
  let failedCount = 0;

  const targetDateObj = new Date(targetDateStr);
  const period1 = new Date(targetDateObj.getTime() - 4 * 86400000); // 4 days buffer
  const period2 = new Date(targetDateObj.getTime() + 1 * 86400000);

  defaultRateLimiter.clearFailedQueue();

  for (const asset of assets) {
    const ySymbol = resolveYahooSymbol(asset.symbol, asset.exchange);
    try {
      const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
        return await yahooFinance.historical(ySymbol, {
          period1,
          period2,
          interval: "1d",
        });
      }, asset.symbol);

      if (rawCandles && rawCandles.length > 0) {
        // Upsert all fetched recent candles for global assets to ensure continuity
        for (const c of rawCandles) {
          if (c && !isPhantomOrUnopenedCandle(c)) {
            candleBatch.push([
              asset.symbol,
              formatDateStr(c.date),
              Number(c.open.toFixed(4)),
              Number(c.high.toFixed(4)),
              Number(c.low.toFixed(4)),
              Number(c.close.toFixed(4)),
              c.adjClose !== undefined && c.adjClose !== null && !isNaN(Number(c.adjClose)) ? Number(c.adjClose.toFixed(4)) : Number(c.close.toFixed(4)),
              c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
            ]);
          }
        }
        syncedCount++;
      }
    } catch (err) {
      failedCount++;
      console.error(
        `[EODSync] [${new Date().toISOString()}] Error syncing global asset ${asset.symbol}:`,
        err.message
      );
    }
  }

  // Bulk Upsert Pass 1 into global_assets
  if (candleBatch.length > 0) {
    await bulkUpsertGlobalAssets(candleBatch.splice(0, candleBatch.length));
  }

  // Multi-pass retry for global assets if any failed due to rate limits/network
  const maxRetryPasses = options.maxRetryPasses !== undefined ? options.maxRetryPasses : 2;
  let retryPass = 0;
  let totalRecovered = 0;

  while (retryPass < maxRetryPasses) {
    const retryable = defaultRateLimiter.getRetryableFailedQueue();
    if (!retryable || retryable.length === 0) break;

    retryPass++;
    const cooldownSec = 15 * retryPass;
    console.warn(
      `[EODSync] [${new Date().toISOString()}] ⚠️ Found ${retryable.length} failed global assets. Waiting ${cooldownSec}s cooldown before Retry Pass ${retryPass}...`
    );
    await new Promise((resolve) => setTimeout(resolve, cooldownSec * 1000));

    const retrySet = new Set(retryable.map((r) => r.identifier));
    const assetsToRetry = assets.filter(
      (a) => retrySet.has(a.symbol) || retrySet.has(resolveYahooSymbol(a.symbol, a.exchange))
    );

    defaultRateLimiter.clearFailedQueue();
    let recoveredInPass = 0;

    for (const asset of assetsToRetry) {
      const ySymbol = resolveYahooSymbol(asset.symbol, asset.exchange);
      try {
        const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
          return await yahooFinance.historical(ySymbol, {
            period1,
            period2,
            interval: "1d",
          });
        }, asset.symbol);

        if (rawCandles && rawCandles.length > 0) {
          for (const c of rawCandles) {
            if (c && !isPhantomOrUnopenedCandle(c)) {
              candleBatch.push([
                asset.symbol,
                formatDateStr(c.date),
                Number(c.open.toFixed(4)),
                Number(c.high.toFixed(4)),
                Number(c.low.toFixed(4)),
                Number(c.close.toFixed(4)),
                c.adjClose !== undefined && c.adjClose !== null && !isNaN(Number(c.adjClose)) ? Number(c.adjClose.toFixed(4)) : Number(c.close.toFixed(4)),
                c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
              ]);
            }
          }
          recoveredInPass++;
          totalRecovered++;
          syncedCount++;
          failedCount = Math.max(0, failedCount - 1);
        }
      } catch (err) {
        // Still failed
      }
    }

    if (candleBatch.length > 0) {
      await bulkUpsertGlobalAssets(candleBatch.splice(0, candleBatch.length));
    }

    console.log(
      `[EODSync] [${new Date().toISOString()}] Global Assets Retry Pass ${retryPass} completed. Recovered ${recoveredInPass}/${assetsToRetry.length} assets.`
    );
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[EODSync] [${new Date().toISOString()}] Finished Global Assets sync in ${(durationMs / 1000).toFixed(1)}s. Total assets: ${assets.length}, Synced: ${syncedCount} (Recovered: ${totalRecovered}), Failed: ${failedCount}.`
  );

  return {
    success: true,
    market: "GLOBAL",
    totalSymbols: assets.length,
    syncedCount,
    failedCount,
    recoveredCount: totalRecovered,
    retryPassesRun: retryPass,
    recordsInserted: syncedCount,
    durationMs,
  };
}

/**
 * ============================================================================
 * 3. WEEKLY SPLIT & CORPORATE ACTION RECONCILIATION
 * ============================================================================
 * Pulls past 30 days of data to update adjusted historical prices for stock splits,
 * bonuses, and dividends.
 */
export async function reconcileHistoricalData(options = {}) {
  const startTime = Date.now();
  const days = options.days || 30;
  console.log(
    `[EODSync] [${new Date().toISOString()}] Starting Weekly Corporate Action & Split Reconciliation (Past ${days} days)...`
  );

  // 1. Fetch all symbols from symbols table
  let allSymbols = [];
  try {
    const [rows] = await pool.query(
      `SELECT symbol, exchange FROM symbols ORDER BY symbol ASC`
    );
    allSymbols = rows;
  } catch (dbErr) {
    console.error(`[EODSync] Error fetching symbols for reconciliation:`, dbErr.message);
    throw dbErr;
  }

  if (options.limit && !isNaN(Number(options.limit))) {
    allSymbols = allSymbols.slice(0, Number(options.limit));
  }

  console.log(
    `[EODSync] [${new Date().toISOString()}] Reconciling ${allSymbols.length} total symbols over past ${days} days...`
  );

  const period1 = new Date(Date.now() - (days + 2) * 86400000);
  const period2 = new Date();

  defaultRateLimiter.clearFailedQueue();
  let reconciledCount = 0;
  let failedCount = 0;
  const indianBatch = [];
  const globalBatch = [];
  const batchSize = 100;

  for (let i = 0; i < allSymbols.length; i++) {
    const item = allSymbols[i];
    const isGlobal = item.exchange === "CRYPTO" || item.exchange === "METALS";
    const ySymbol = isGlobal ? item.symbol : resolveYahooSymbol(item.symbol, item.exchange);

    try {
      const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
        return await yahooFinance.historical(ySymbol, {
          period1,
          period2,
          interval: "1d",
        });
      }, ySymbol);

      if (rawCandles && rawCandles.length > 0) {
        for (const c of rawCandles) {
          if (c && !isPhantomOrUnopenedCandle(c)) {
            if (isGlobal) {
              globalBatch.push([
                item.symbol,
                formatDateStr(c.date),
                Number(c.open.toFixed(4)),
                Number(c.high.toFixed(4)),
                Number(c.low.toFixed(4)),
                Number(c.close.toFixed(4)),
                c.adjClose !== undefined && c.adjClose !== null && !isNaN(Number(c.adjClose)) ? Number(c.adjClose.toFixed(4)) : Number(c.close.toFixed(4)),
                c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
              ]);
            } else {
              indianBatch.push([
                item.symbol,
                formatDateStr(c.date),
                Number(c.open.toFixed(4)),
                Number(c.high.toFixed(4)),
                Number(c.low.toFixed(4)),
                Number(c.close.toFixed(4)),
                c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
              ]);
            }
          }
        }
        reconciledCount++;
      }
    } catch (err) {
      failedCount++;
    }

    if (indianBatch.length >= batchSize) {
      await bulkUpsertHistoricalCandles(indianBatch.splice(0, indianBatch.length));
    }
    if (globalBatch.length >= batchSize) {
      await bulkUpsertGlobalAssets(globalBatch.splice(0, globalBatch.length));
    }

    if ((i + 1) % 100 === 0 || i === allSymbols.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[EODSync] [${new Date().toISOString()}] Reconciliation Progress: ${i + 1}/${allSymbols.length} (${reconciledCount} reconciled, ${failedCount} failed) in ${elapsed}s`
      );
    }
  }

  // Flush remaining Pass 1
  if (indianBatch.length > 0) await bulkUpsertHistoricalCandles(indianBatch.splice(0, indianBatch.length));
  if (globalBatch.length > 0) await bulkUpsertGlobalAssets(globalBatch.splice(0, globalBatch.length));

  // Multi-pass retry for reconciliation
  const maxRetryPasses = options.maxRetryPasses !== undefined ? options.maxRetryPasses : 2;
  let retryPass = 0;
  let totalRecovered = 0;

  while (retryPass < maxRetryPasses) {
    const retryable = defaultRateLimiter.getRetryableFailedQueue();
    if (!retryable || retryable.length === 0) break;

    retryPass++;
    const cooldownSec = 30 * retryPass;
    console.warn(
      `[EODSync] [${new Date().toISOString()}] ⚠️ Found ${retryable.length} failed reconciliation symbols. Waiting ${cooldownSec}s cooldown before Retry Pass ${retryPass}...`
    );
    await new Promise((resolve) => setTimeout(resolve, cooldownSec * 1000));

    const retrySet = new Set(retryable.map((r) => r.identifier));
    const symbolsToRetry = allSymbols.filter((s) => {
      const isGlobal = s.exchange === "CRYPTO" || s.exchange === "METALS";
      const ySym = isGlobal ? s.symbol : resolveYahooSymbol(s.symbol, s.exchange);
      return retrySet.has(ySym) || retrySet.has(s.symbol);
    });

    defaultRateLimiter.clearFailedQueue();
    let recoveredInPass = 0;

    for (let i = 0; i < symbolsToRetry.length; i++) {
      const item = symbolsToRetry[i];
      const isGlobal = item.exchange === "CRYPTO" || item.exchange === "METALS";
      const ySymbol = isGlobal ? item.symbol : resolveYahooSymbol(item.symbol, item.exchange);

      try {
        const rawCandles = await defaultRateLimiter.executeWithRetry(async () => {
          return await yahooFinance.historical(ySymbol, {
            period1,
            period2,
            interval: "1d",
          });
        }, ySymbol);

        if (rawCandles && rawCandles.length > 0) {
          for (const c of rawCandles) {
            if (c && !isPhantomOrUnopenedCandle(c)) {
              if (isGlobal) {
                globalBatch.push([
                  item.symbol,
                  formatDateStr(c.date),
                  Number(c.open.toFixed(4)),
                  Number(c.high.toFixed(4)),
                  Number(c.low.toFixed(4)),
                  Number(c.close.toFixed(4)),
                  c.adjClose !== undefined && c.adjClose !== null && !isNaN(Number(c.adjClose)) ? Number(c.adjClose.toFixed(4)) : Number(c.close.toFixed(4)),
                  c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
                ]);
              } else {
                indianBatch.push([
                  item.symbol,
                  formatDateStr(c.date),
                  Number(c.open.toFixed(4)),
                  Number(c.high.toFixed(4)),
                  Number(c.low.toFixed(4)),
                  Number(c.close.toFixed(4)),
                  c.volume !== undefined && c.volume !== null && !isNaN(Number(c.volume)) ? Number(c.volume) : 0,
                ]);
              }
            }
          }
          recoveredInPass++;
          totalRecovered++;
          reconciledCount++;
          failedCount = Math.max(0, failedCount - 1);
        }
      } catch (err) {
        // Still failed
      }

      if (indianBatch.length >= batchSize) {
        await bulkUpsertHistoricalCandles(indianBatch.splice(0, indianBatch.length));
      }
      if (globalBatch.length >= batchSize) {
        await bulkUpsertGlobalAssets(globalBatch.splice(0, globalBatch.length));
      }
    }

    if (indianBatch.length > 0) await bulkUpsertHistoricalCandles(indianBatch.splice(0, indianBatch.length));
    if (globalBatch.length > 0) await bulkUpsertGlobalAssets(globalBatch.splice(0, globalBatch.length));

    console.log(
      `[EODSync] [${new Date().toISOString()}] Reconciliation Retry Pass ${retryPass} completed. Recovered ${recoveredInPass}/${symbolsToRetry.length} symbols.`
    );
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[EODSync] [${new Date().toISOString()}] Finished 30-day Reconciliation in ${(durationMs / 1000).toFixed(1)}s. Reconciled: ${reconciledCount} (Recovered: ${totalRecovered}), Failed: ${failedCount}.`
  );

  return {
    success: true,
    totalSymbols: allSymbols.length,
    reconciledCount,
    failedCount,
    recoveredCount: totalRecovered,
    retryPassesRun: retryPass,
    durationMs,
  };
}

async function bulkUpsertGlobalAssets(records) {
  if (!records || records.length === 0) return;
  const query = `
    INSERT INTO global_assets (symbol, date, open, high, low, close, adj_close, volume)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      open = VALUES(open),
      high = VALUES(high),
      low = VALUES(low),
      close = VALUES(close),
      adj_close = VALUES(adj_close),
      volume = VALUES(volume)
  `;
  await pool.query(query, [records]);
}

