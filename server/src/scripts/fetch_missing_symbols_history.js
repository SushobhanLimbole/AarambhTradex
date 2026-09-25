import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YahooFinance from "yahoo-finance2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  database: process.env.MYSQL_DATABASE || "market_data",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const yf = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

function formatDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function createMissingSymbolsTable(pool) {
  const sql = `
    CREATE TABLE IF NOT EXISTS missing_symbols (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      company_name VARCHAR(255) NULL,
      date DATE NOT NULL,
      open DECIMAL(15,4) NULL,
      high DECIMAL(15,4) NULL,
      low DECIMAL(15,4) NULL,
      close DECIMAL(15,4) NULL,
      volume BIGINT NULL,
      exchange VARCHAR(10) DEFAULT 'NSE',
      UNIQUE KEY uniq_sym_date (symbol, date),
      INDEX idx_sym (symbol),
      INDEX idx_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await pool.query(sql);
  console.log("✅ Table `missing_symbols` verified/created in database `market_data`.");
}

function parseMissingSymbolsCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const list = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^"([^"]+)","?([^"]*)"?$/);
    let sym = "";
    let name = "";
    if (match) {
      sym = match[1].trim();
      name = match[2].trim();
    } else {
      const parts = line.split(",");
      sym = parts[0].replace(/"/g, "").trim();
      name = parts.slice(1).join(",").replace(/"/g, "").trim();
    }
    if (sym && !seen.has(sym)) {
      seen.add(sym);
      list.push({ symbol: sym, companyName: name });
    }
  }
  return list;
}

async function fetchHistoricalData(symbol) {
  const candidates = [
    { ticker: `${symbol}.NS`, exchange: "NSE" },
    { ticker: `${symbol}.BO`, exchange: "BSE" },
  ];

  for (const item of candidates) {
    try {
      const results = await yf.historical(item.ticker, {
        period1: "1970-01-01",
        period2: new Date(),
        interval: "1d",
      });

      if (results && results.length > 0) {
        return { candles: results, exchange: item.exchange, ticker: item.ticker };
      }
    } catch (err) {
      // Continue to fallback
    }
  }

  throw new Error(`No historical data found on NSE or BSE for symbol: ${symbol}`);
}

async function bulkInsertCandles(pool, symbol, companyName, candles, exchange) {
  if (!candles || candles.length === 0) return 0;

  const validRows = [];
  for (const c of candles) {
    const dateStr = formatDate(c.date);
    if (!dateStr) continue;

    const openVal = c.open !== null && !isNaN(c.open) ? c.open : null;
    const highVal = c.high !== null && !isNaN(c.high) ? c.high : null;
    const lowVal = c.low !== null && !isNaN(c.low) ? c.low : null;
    const closeVal = c.close !== null && !isNaN(c.close) ? c.close : null;
    const volVal = c.volume !== null && !isNaN(c.volume) ? Math.round(c.volume) : 0;

    if (openVal === null && closeVal === null && highVal === null && lowVal === null) {
      continue;
    }

    validRows.push([symbol, companyName || null, dateStr, openVal, highVal, lowVal, closeVal, volVal, exchange]);
  }

  if (validRows.length === 0) return 0;

  // Insert in chunks of 500
  const CHUNK_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const sql = `
      INSERT INTO missing_symbols (symbol, company_name, date, open, high, low, close, volume, exchange)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        company_name = VALUES(company_name),
        open = VALUES(open),
        high = VALUES(high),
        low = VALUES(low),
        close = VALUES(close),
        volume = VALUES(volume),
        exchange = VALUES(exchange);
    `;
    const [res] = await pool.query(sql, [chunk]);
    totalInserted += chunk.length;
  }

  return totalInserted;
}

async function run() {
  const startTime = Date.now();
  const pool = mysql.createPool(dbConfig);

  console.log("==================================================================");
  console.log("🚀 Starting Historical Data Sync for Missing Symbols into MySQL");
  console.log(`📅 Database: ${dbConfig.database} | Host: ${dbConfig.host}`);
  console.log("==================================================================");

  await createMissingSymbolsTable(pool);

  const csvPath = path.join(__dirname, "..", "..", "..", "niftyCsv", "missing_symbols.csv");
  const symbolsList = parseMissingSymbolsCsv(csvPath);

  console.log(`📊 Total unique symbols to process from CSV: ${symbolsList.length}`);

  let successCount = 0;
  let failCount = 0;
  let totalCandlesStored = 0;
  const failedSymbols = [];

  // Process with concurrency limit of 5 to balance speed & avoid rate-limits
  const CONCURRENCY = 5;
  for (let i = 0; i < symbolsList.length; i += CONCURRENCY) {
    const batch = symbolsList.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (item, batchIdx) => {
        const index = i + batchIdx + 1;
        try {
          const { candles, exchange, ticker } = await fetchHistoricalData(item.symbol);
          const count = await bulkInsertCandles(pool, item.symbol, item.companyName, candles, exchange);
          
          totalCandlesStored += count;
          successCount++;

          const firstDate = formatDate(candles[0]?.date) || "origin";
          const lastDate = formatDate(candles[candles.length - 1]?.date) || "now";

          console.log(
            `[${index}/${symbolsList.length}] ✅ ${item.symbol} (${ticker}): ${count.toLocaleString()} candles stored [${firstDate} to ${lastDate}]`
          );
        } catch (err) {
          failCount++;
          failedSymbols.push({ symbol: item.symbol, reason: err.message });
          console.warn(`[${index}/${symbolsList.length}] ⚠️ ${item.symbol}: ${err.message}`);
        }
      })
    );
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("==================================================================");
  console.log("🎉 HISTORICAL SYNC COMPLETE!");
  console.log(`⏱️ Duration: ${durationSec}s`);
  console.log(`✅ Success: ${successCount} symbols`);
  console.log(`⚠️ Failed: ${failCount} symbols`);
  console.log(`📈 Total Candles Stored in missing_symbols: ${totalCandlesStored.toLocaleString()}`);
  if (failedSymbols.length > 0) {
    console.log(`❌ Failed symbols list:`, failedSymbols.map((f) => f.symbol).join(", "));
  }
  console.log("==================================================================");

  await pool.end();
}

run().catch((err) => {
  console.error("Fatal Error running sync:", err);
  process.exit(1);
});
