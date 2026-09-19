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

  console.log("2. Aggregating distinct symbols from 'historical_candles'...");
  const [rows] = await pool.query(`
    SELECT 
      symbol,
      CASE 
        WHEN symbol = '^BSESN' OR symbol LIKE '%.BO' THEN 'BSE'
        WHEN symbol = '^NSEI' OR symbol LIKE '%.NS' THEN 'NSE'
        ELSE COALESCE(MAX(exchange), 'NSE')
      END AS exchange,
      MAX(indice) AS indice,
      COUNT(*) AS total_candles,
      MIN(date) AS first_date,
      MAX(date) AS last_date
    FROM historical_candles
    GROUP BY symbol
    ORDER BY symbol ASC
  `);

  console.log(`Found ${rows.length} distinct symbols in historical_candles. Populating symbols_metadata...`);

  // Insert or update in chunks of 500
  const chunkSize = 500;
  let insertedOrUpdated = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((r) => [
      r.symbol,
      r.exchange,
      r.indice,
      r.total_candles,
      r.first_date,
      r.last_date,
    ]);

    await pool.query(
      `
      INSERT INTO symbols_metadata (symbol, exchange, indice, total_candles, first_date, last_date)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        exchange = VALUES(exchange),
        indice = VALUES(indice),
        total_candles = VALUES(total_candles),
        first_date = VALUES(first_date),
        last_date = VALUES(last_date)
    `,
      [values]
    );

    insertedOrUpdated += chunk.length;
    console.log(`✓ Synchronized ${insertedOrUpdated} / ${rows.length} symbols.`);
  }

  // Also ensure index on historical_candles for symbol & date for high-speed queries
  console.log("3. Ensuring performance indexes on 'historical_candles'...");
  try {
    await pool.query("ALTER TABLE historical_candles ADD INDEX idx_candle_sym_date (symbol, date)");
    console.log("✓ Added composite index idx_candle_sym_date on historical_candles.");
  } catch (err) {
    if (err.code === "ER_DUP_KEYNAME") {
      console.log("Index on historical_candles already exists.");
    } else {
      console.warn("Index note:", err.message);
    }
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
