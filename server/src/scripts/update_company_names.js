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

function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
}

// Helper to fetch company name from Yahoo Finance with strict timeout
async function fetchCompanyName(symbol, exchange) {
  const candidates = [];
  const raw = String(symbol).trim();

  // If already has .NS, .BO, =, -, ^, try directly first
  candidates.push(raw);

  if (!raw.endsWith(".NS") && !raw.endsWith(".BO") && !raw.includes("=") && !raw.startsWith("^")) {
    if (exchange === "BSE") {
      candidates.push(`${raw}.BO`);
      candidates.push(`${raw}.NS`);
    } else {
      candidates.push(`${raw}.NS`);
      candidates.push(`${raw}.BO`);
    }
  }

  for (const ticker of candidates) {
    try {
      const q = await Promise.race([
        yf.quote(ticker),
        timeoutPromise(3000)
      ]);
      if (q && (q.longName || q.shortName)) {
        return q.longName || q.shortName;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function updateCompanyNames() {
  const startTime = Date.now();
  console.log("==================================================================");
  console.log("🚀 Starting Company Name Resolution & Database Update (Fast Mode)");
  console.log(`📅 Database: ${dbConfig.database} | Host: ${dbConfig.host}`);
  console.log("==================================================================");

  const pool = mysql.createPool(dbConfig);

  // 1. Fetch symbols where company_name is missing or equal to symbol
  const [rows] = await pool.query(`
    SELECT symbol, company_name, exchange
    FROM symbols
    WHERE company_name = symbol OR company_name IS NULL OR company_name = ''
    ORDER BY symbol ASC
  `);

  console.log(`📊 Total remaining symbols needing company name update: ${rows.length.toLocaleString()}`);

  if (rows.length === 0) {
    console.log("✅ All symbols already have valid company names.");
    await pool.end();
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  const updatesBatch = [];

  // Batch update helper
  async function flushUpdates(updates) {
    if (updates.length === 0) return;
    for (const { symbol, companyName } of updates) {
      await pool.query("UPDATE symbols SET company_name = ? WHERE symbol = ?", [companyName, symbol]);
      await pool.query("UPDATE symbols_metadata SET company_name = ? WHERE symbol = ?", [companyName, symbol]);
    }
  }

  const CONCURRENCY = 20;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map(async (row, idxInChunk) => {
        const globalIdx = i + idxInChunk + 1;
        const name = await fetchCompanyName(row.symbol, row.exchange);

        if (name && name.trim() !== "" && name.trim() !== row.symbol) {
          updatesBatch.push({ symbol: row.symbol, companyName: name.trim() });
          updatedCount++;
          console.log(`[${globalIdx}/${rows.length}] ✅ ${row.symbol} -> "${name.trim()}"`);
        } else {
          skippedCount++;
          console.log(`[${globalIdx}/${rows.length}] ℹ️ ${row.symbol} -> (No change)`);
        }
      })
    );

    if (updatesBatch.length >= 25) {
      const toFlush = updatesBatch.splice(0, updatesBatch.length);
      await flushUpdates(toFlush);
    }
  }

  // Flush remaining updates
  if (updatesBatch.length > 0) {
    await flushUpdates(updatesBatch);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("==================================================================");
  console.log("🎉 COMPANY NAME UPDATE COMPLETE!");
  console.log(`⏱️ Duration: ${durationSec}s`);
  console.log(`✅ Successfully Updated: ${updatedCount.toLocaleString()} symbols`);
  console.log(`ℹ️ Skipped / Unchanged: ${skippedCount.toLocaleString()} symbols`);
  console.log("==================================================================");

  await pool.end();
}

updateCompanyNames().catch((err) => {
  console.error("Fatal Error updating company names:", err);
  process.exit(1);
});
