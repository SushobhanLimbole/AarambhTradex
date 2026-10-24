import { getCandles } from "@mathieuc/tradingview/data";
import pool from "../src/config/mysql.js";
import {
  isIndianMarketHoliday,
  isMetalsMarketHoliday,
  isPhantomOrUnopenedCandle,
} from "../src/utils/holidayUtils.js";

const METALS_SYMBOLS = [
  {
    symbol: "DELTAIN:PAXGUSD.P",
    rawSymbol: "PAXGUSD.P",
    name: "Paxos Gold (PAXG) Delta Perpetual",
  },
  {
    symbol: "DELTAIN:XAUTUSD.P",
    rawSymbol: "XAUTUSD.P",
    name: "Gold (XAUT) Delta Perpetual",
  },
  {
    symbol: "DELTAIN:SLVONUSD.P",
    rawSymbol: "SLVONUSD.P",
    name: "Silver (SLVON) Delta Perpetual",
  },
];

async function syncMetals() {
  console.log("=== 1. CREATING TEMP METALS TABLE ===");
  // Create persistent temp table temp_metals_data (and temp_global_assets)
  const createTempTableSql = `
    CREATE TABLE IF NOT EXISTS \`temp_metals_data\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`symbol\` VARCHAR(50) NOT NULL,
      \`date\` DATE NOT NULL,
      \`open\` DECIMAL(15,4) DEFAULT NULL,
      \`high\` DECIMAL(15,4) DEFAULT NULL,
      \`low\` DECIMAL(15,4) DEFAULT NULL,
      \`close\` DECIMAL(15,4) DEFAULT NULL,
      \`adj_close\` DECIMAL(15,4) DEFAULT NULL,
      \`volume\` BIGINT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_symbol_date\` (\`symbol\`,\`date\`),
      KEY \`idx_sym_date\` (\`symbol\`,\`date\`),
      KEY \`idx_date\` (\`date\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await pool.query(createTempTableSql);

  const createTempGlobalAssetsSql = `
    CREATE TABLE IF NOT EXISTS \`temp_global_assets\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`symbol\` VARCHAR(50) NOT NULL,
      \`date\` DATE NOT NULL,
      \`open\` DECIMAL(15,4) DEFAULT NULL,
      \`high\` DECIMAL(15,4) DEFAULT NULL,
      \`low\` DECIMAL(15,4) DEFAULT NULL,
      \`close\` DECIMAL(15,4) DEFAULT NULL,
      \`adj_close\` DECIMAL(15,4) DEFAULT NULL,
      \`volume\` BIGINT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_symbol_date\` (\`symbol\`,\`date\`),
      KEY \`idx_sym_date\` (\`symbol\`,\`date\`),
      KEY \`idx_date\` (\`date\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await pool.query(createTempGlobalAssetsSql);

  // Clear temp tables before fresh insertion
  await pool.query("TRUNCATE TABLE `temp_metals_data`");
  await pool.query("TRUNCATE TABLE `temp_global_assets`");
  console.log("✓ Created & truncated temp_metals_data and temp_global_assets");

  console.log("\n=== 2. FETCHING & FILTERING METALS DATA (EXCLUDING HOLIDAYS) ===");
  const allFilteredCandles = [];

  for (const item of METALS_SYMBOLS) {
    console.log(`\nFetching all historical candles for ${item.symbol}...`);
    try {
      const rawCandles = await getCandles({
        symbol: item.symbol,
        timeframe: "D",
        count: 10000,
      });

      console.log(`Raw candles returned from TradingView: ${rawCandles.length}`);

      let holidayCount = 0;
      let weekendCount = 0;
      let phantomCount = 0;
      let cleanCandles = [];

      for (const c of rawCandles) {
        if (!c || !c.time || c.close == null) continue;

        const dateObj = new Date(c.time * 1000);
        const dateStr = dateObj.toISOString().slice(0, 10);
        const dow = dateObj.getUTCDay(); // 0 = Sun, 6 = Sat

        const isWeekend = dow === 0 || dow === 6;
        if (isWeekend) weekendCount++;

        const indHol = isIndianMarketHoliday(dateStr);
        const metHol = isMetalsMarketHoliday(dateStr);
        const isPhan = isPhantomOrUnopenedCandle(c);

        if (isPhan) phantomCount++;

        // Holiday condition: Weekend or market holiday or phantom candle
        if (indHol.isHoliday || metHol.isHoliday || isPhan) {
          holidayCount++;
          continue; // SKIP HOLIDAY
        }

        const open = Number(Number(c.open).toFixed(4));
        const high = Number(Number(c.high).toFixed(4));
        const low = Number(Number(c.low).toFixed(4));
        const close = Number(Number(c.close).toFixed(4));
        const adjClose = close;
        const volume = Number(c.volume ?? 0);

        cleanCandles.push({
          symbol: item.symbol,
          date: dateStr,
          open,
          high,
          low,
          close,
          adj_close: adjClose,
          volume,
        });
      }

      console.log(`✓ Processed ${item.symbol}:`);
      console.log(`  - Raw Total: ${rawCandles.length}`);
      console.log(`  - Excluded Holidays/Weekends: ${holidayCount} (Weekends: ${weekendCount}, Phantoms: ${phantomCount})`);
      console.log(`  - Clean Trading Day Candles: ${cleanCandles.length}`);
      console.log(`  - Date Range: ${cleanCandles[0]?.date} to ${cleanCandles[cleanCandles.length - 1]?.date}`);

      allFilteredCandles.push(...cleanCandles);
    } catch (err) {
      console.error(`✗ Error fetching ${item.symbol}:`, err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n=== 3. INSERTING INTO TEMP TABLES (${allFilteredCandles.length} RECORDS) ===`);
  const chunkSize = 200;
  for (let i = 0; i < allFilteredCandles.length; i += chunkSize) {
    const chunk = allFilteredCandles.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = [];
    for (const r of chunk) {
      values.push(r.symbol, r.date, r.open, r.high, r.low, r.close, r.adj_close, r.volume);
    }

    await pool.query(
      `INSERT INTO \`temp_metals_data\` (symbol, date, open, high, low, close, adj_close, volume) VALUES ${placeholders}`,
      values
    );
    await pool.query(
      `INSERT INTO \`temp_global_assets\` (symbol, date, open, high, low, close, adj_close, volume) VALUES ${placeholders}`,
      values
    );
  }
  console.log(`✓ Inserted ${allFilteredCandles.length} records into temp_metals_data and temp_global_assets`);

  console.log("\n=== 4. INSERTING INTO GLOBAL_ASSETS TABLE ===");
  // Remove old metals rows (which had weekend and holiday dates) to replace with clean data
  const metalsSymbols = METALS_SYMBOLS.map((m) => m.symbol);
  await pool.query(
    `DELETE FROM \`global_assets\` WHERE symbol IN (${metalsSymbols.map(() => "?").join(", ")})`,
    metalsSymbols
  );

  for (let i = 0; i < allFilteredCandles.length; i += chunkSize) {
    const chunk = allFilteredCandles.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = [];
    for (const r of chunk) {
      values.push(r.symbol, r.date, r.open, r.high, r.low, r.close, r.adj_close, r.volume);
    }

    await pool.query(
      `INSERT INTO \`global_assets\` (symbol, date, open, high, low, close, adj_close, volume) VALUES ${placeholders}`,
      values
    );
  }
  console.log(`✓ Inserted ${allFilteredCandles.length} clean metals records into global_assets`);

  console.log("\n=== 5. UPDATING SYMBOLS & INDEX_CONSTITUENTS (METALS) ===");
  // 1. Ensure Metals index (id: 45) exists
  const [indexRows] = await pool.query(
    "SELECT index_id FROM indices WHERE index_name = 'Metals'"
  );
  let metalsIndexId = indexRows[0]?.index_id || 45;

  for (const item of METALS_SYMBOLS) {
    // Upsert into symbols
    await pool.query(
      `INSERT INTO \`symbols\` (symbol, company_name, exchange)
       VALUES (?, ?, 'METALS')
       ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), exchange = 'METALS'`,
      [item.symbol, item.name]
    );

    // Upsert into index_constituents
    await pool.query(
      `INSERT IGNORE INTO \`index_constituents\` (symbol, index_id) VALUES (?, ?)`,
      [item.symbol, metalsIndexId]
    );
    console.log(`✓ Registered ${item.symbol} as METALS instrument in symbols & index_constituents`);
  }

  console.log("\n=== 6. VERIFICATION SUMMARY ===");
  const [tempCount] = await pool.query(
    "SELECT symbol, count(*), min(date), max(date) FROM temp_metals_data GROUP BY symbol"
  );
  console.log("temp_metals_data:", tempCount);

  const [gaCount] = await pool.query(
    "SELECT symbol, count(*), min(date), max(date) FROM global_assets WHERE symbol LIKE '%USD.P' GROUP BY symbol"
  );
  console.log("global_assets metals & crypto:", gaCount);

  console.log("\nAll tasks completed successfully!");
  process.exit(0);
}

syncMetals().catch((err) => {
  console.error("Fatal error during metals sync:", err);
  process.exit(1);
});
