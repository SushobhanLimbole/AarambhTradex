import pool from "../config/mysql.js";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["ripHistorical"] });

const NSE_INDICES = [
  { symbol: "^NSEI", name: "Nifty 50", indexName: "Nifty 50", exchange: "NSE" },
  { symbol: "^NSEBANK", name: "Nifty Bank", indexName: "Nifty Bank", exchange: "NSE" },
  { symbol: "^CNXIT", name: "Nifty IT", indexName: "Nifty IT", exchange: "NSE" },
  { symbol: "^CRSLDX", name: "Nifty 500", indexName: "Nifty 500", exchange: "NSE" },
  { symbol: "^NSMIDCP", name: "Nifty Next 50", indexName: "Nifty Next 50", exchange: "NSE" },
  { symbol: "^CNXPHARMA", name: "Nifty Pharma", indexName: "Nifty Pharma", exchange: "NSE" },
  { symbol: "^NSEMDCP50", name: "Nifty Midcap 50", indexName: "Nifty Midcap 50", exchange: "NSE" },
  { symbol: "^BSESN", name: "S&P BSE SENSEX", indexName: "Other", exchange: "BSE" },
];

function formatDate(d) {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return dateObj.toISOString().slice(0, 10);
}

async function run() {
  console.log("🚀 Starting NSE & BSE Indices Historical Candle Fetch...");
  let totalCandlesInserted = 0;

  for (const idx of NSE_INDICES) {
    console.log(`\n📌 Processing Index: ${idx.name} (${idx.symbol})...`);

    // 1. Ensure Index exists in `indices` table
    let [idxRows] = await pool.query(
      "SELECT index_id FROM indices WHERE index_name = ? LIMIT 1",
      [idx.indexName]
    );
    let indexId = idxRows[0]?.index_id;
    if (!indexId) {
      const [insRes] = await pool.query(
        "INSERT INTO indices (index_name) VALUES (?)",
        [idx.indexName]
      );
      indexId = insRes.insertId;
    }

    // 2. Insert/Update into `symbols` table
    await pool.query(
      `INSERT INTO symbols (symbol, company_name, exchange) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), exchange = VALUES(exchange)`,
      [idx.symbol, idx.name, idx.exchange]
    );

    // 3. Insert/Update into `index_constituents` table
    await pool.query(
      "INSERT IGNORE INTO index_constituents (symbol, index_id) VALUES (?, ?)",
      [idx.symbol, indexId]
    );

    // 4. Fetch full historical candles from Yahoo Finance
    try {
      const chart = await yf.chart(idx.symbol, {
        period1: "1990-01-01",
        period2: "2026-09-26",
        interval: "1d",
      });

      const quotes = (chart.quotes || []).filter(
        (q) => q.close !== null && q.close !== undefined && q.date
      );

      if (quotes.length === 0) {
        console.log(`   ⚠️ No candles returned for ${idx.symbol}.`);
        continue;
      }

      console.log(
        `   📊 Retrieved ${quotes.length} candles from ${formatDate(quotes[0].date)} to ${formatDate(quotes[quotes.length - 1].date)}`
      );

      // 5. Bulk insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < quotes.length; i += batchSize) {
        const batch = quotes.slice(i, i + batchSize).map((q) => [
          idx.symbol,
          formatDate(q.date),
          q.open !== null && q.open !== undefined ? Number(q.open.toFixed(4)) : null,
          q.high !== null && q.high !== undefined ? Number(q.high.toFixed(4)) : null,
          q.low !== null && q.low !== undefined ? Number(q.low.toFixed(4)) : null,
          q.close !== null && q.close !== undefined ? Number(q.close.toFixed(4)) : null,
          q.volume !== null && q.volume !== undefined ? Number(q.volume) : 0,
        ]);

        await pool.query(
          `INSERT INTO historical_candles (symbol, date, open, high, low, close, volume)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             open = VALUES(open),
             high = VALUES(high),
             low = VALUES(low),
             close = VALUES(close),
             volume = VALUES(volume)`,
          [batch]
        );
      }

      totalCandlesInserted += quotes.length;
      console.log(`   ✓ Successfully synced ${quotes.length} candles for ${idx.symbol}.`);
    } catch (err) {
      console.error(`   ❌ Failed to fetch candles for ${idx.symbol}:`, err.message);
    }
  }

  console.log(`\n🎉 Finished! Synced total ${totalCandlesInserted} index candles across ${NSE_INDICES.length} major indices.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error during index sync:", err);
  process.exit(1);
});
