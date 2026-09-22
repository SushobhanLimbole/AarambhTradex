import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../server/.env") });

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  database: process.env.MYSQL_DATABASE || "market_data",
};

export async function createAndPopulateSymbolsMetadata() {
  console.log("Connecting to MySQL Database...");
  const pool = await mysql.createPool(dbConfig);

  console.log("1. Creating table 'symbols_metadata' if not exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS symbols_metadata (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL UNIQUE,
      exchange VARCHAR(20) NOT NULL DEFAULT 'NSE',
      indice VARCHAR(100) DEFAULT NULL,
      company_name VARCHAR(255) DEFAULT NULL,
      total_candles INT DEFAULT 0,
      first_date DATE DEFAULT NULL,
      last_date DATE DEFAULT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sym (symbol),
      INDEX idx_exch (exchange),
      INDEX idx_ind (indice)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("2. Aggregating distinct symbols from 'historical_candles' and 'global_assets'...");
  const [candlesRows] = await pool.query(`
    SELECT 
      symbol,
      CASE 
        WHEN symbol = '^BSESN' OR symbol LIKE '%.BO' THEN 'BSE'
        WHEN symbol = '^NSEI' OR symbol LIKE '%.NS' THEN 'NSE'
        ELSE COALESCE(MAX(exchange), 'NSE')
      END AS exchange,
      MAX(indice) AS indice,
      NULL AS company_name,
      COUNT(*) AS total_candles,
      MIN(date) AS first_date,
      MAX(date) AS last_date
    FROM historical_candles
    GROUP BY symbol
  `);

  const [globalRows] = await pool.query(`
    SELECT 
      symbol,
      UPPER(exchange) AS exchange,
      CASE 
        WHEN UPPER(exchange) = 'CRYPTO' THEN 'Crypto'
        WHEN UPPER(exchange) = 'METALS' THEN 'Metals'
        ELSE COALESCE(MAX(indice), 'Global Assets')
      END AS indice,
      CASE 
        WHEN symbol = 'BTC-USD' THEN 'Bitcoin USD'
        WHEN symbol = 'ETH-USD' THEN 'Ethereum USD'
        WHEN symbol = 'SOL-USD' THEN 'Solana USD'
        WHEN symbol = 'XRP-USD' THEN 'XRP USD'
        WHEN symbol = 'XAUUSD=X' THEN 'Gold Spot (USD)'
        WHEN symbol = 'XAGUSD=X' THEN 'Silver Spot (USD)'
        ELSE NULL
      END AS company_name,
      COUNT(*) AS total_candles,
      MIN(date) AS first_date,
      MAX(date) AS last_date
    FROM global_assets
    GROUP BY symbol, exchange
  `);

  const rows = [...candlesRows, ...globalRows];
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));

  console.log(`Found ${rows.length} distinct symbols across all markets. Populating symbols_metadata...`);

  // Insert or update in chunks of 500
  const chunkSize = 500;
  let insertedOrUpdated = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((r) => [
      r.symbol,
      r.exchange,
      r.indice,
      r.company_name,
      r.total_candles,
      r.first_date,
      r.last_date,
    ]);

    await pool.query(
      `
      INSERT INTO symbols_metadata (symbol, exchange, indice, company_name, total_candles, first_date, last_date)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        exchange = VALUES(exchange),
        indice = VALUES(indice),
        company_name = VALUES(company_name),
        total_candles = VALUES(total_candles),
        first_date = VALUES(first_date),
        last_date = VALUES(last_date)
    `,
      [values]
    );

    insertedOrUpdated += chunk.length;
    console.log(`✓ Synchronized ${insertedOrUpdated} / ${rows.length} symbols.`);
  }

  // Also ensure index on historical_candles and global_assets for symbol & date for high-speed queries
  console.log("3. Ensuring performance indexes on 'historical_candles' and 'global_assets'...");
  try {
    await pool.query("ALTER TABLE historical_candles ADD INDEX idx_candle_sym_date (symbol, date)");
  } catch (err) {
    // ignore if exists
  }
  try {
    await pool.query("ALTER TABLE global_assets ADD INDEX idx_global_sym_date (symbol, date)");
    console.log("✓ Added composite index idx_global_sym_date on global_assets.");
  } catch (err) {
    // ignore if exists
  }

  console.log("\nFinished successfully! symbols_metadata is initialized and populated.");
  await pool.end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAndPopulateSymbolsMetadata()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error creating symbols_metadata:", err);
      process.exit(1);
    });
}
