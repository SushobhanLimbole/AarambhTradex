import { getCandles } from "@mathieuc/tradingview/data";
import pool from "../src/config/mysql.js";
import {
  isIndianMarketHoliday,
  isMetalsMarketHoliday,
} from "../src/utils/holidayUtils.js";

const DELTA_TO_CRYPTO = [
  "DELTAIN:PAXGUSD.P",
  "DELTAIN:XAUTUSD.P",
  "DELTAIN:SLVONUSD.P",
];

const OANDA_METALS = [
  {
    symbol: "OANDA:XAUUSD",
    name: "Gold / US Dollar (OANDA)",
    exchange: "METALS",
  },
  {
    symbol: "OANDA:XAGUSD",
    name: "Silver / US Dollar (OANDA)",
    exchange: "METALS",
  },
];

async function run() {
  console.log("==========================================================");
  console.log("1. UPDATING DELTAIN PERPETUALS TO CRYPTO EXCHANGE & INDEX");
  console.log("==========================================================");

  // 1. Get index IDs for Crypto and Metals
  const [cryptoRows] = await pool.query("SELECT index_id FROM indices WHERE index_name = 'Crypto'");
  const [metalsRows] = await pool.query("SELECT index_id FROM indices WHERE index_name = 'Metals'");
  const cryptoIndexId = cryptoRows[0]?.index_id || 44;
  const metalsIndexId = metalsRows[0]?.index_id || 45;

  console.log(`Indices found - Crypto: ${cryptoIndexId}, Metals: ${metalsIndexId}`);

  // 2. Update symbols table for Delta perps
  const placeholders = DELTA_TO_CRYPTO.map(() => "?").join(", ");
  const [symUpdateResult] = await pool.query(
    `UPDATE \`symbols\` SET exchange = 'CRYPTO' WHERE symbol IN (${placeholders})`,
    DELTA_TO_CRYPTO
  );
  console.log(`✓ Updated symbols exchange to 'CRYPTO': ${symUpdateResult.affectedRows} row(s)`);

  // 3. Move from Metals index to Crypto index in index_constituents
  await pool.query(
    `DELETE FROM \`index_constituents\` WHERE index_id = ? AND symbol IN (${placeholders})`,
    [metalsIndexId, ...DELTA_TO_CRYPTO]
  );
  for (const sym of DELTA_TO_CRYPTO) {
    await pool.query(
      `INSERT IGNORE INTO \`index_constituents\` (symbol, index_id) VALUES (?, ?)`,
      [sym, cryptoIndexId]
    );
  }
  console.log(`✓ Updated index_constituents for ${DELTA_TO_CRYPTO.join(", ")} -> Index ID ${cryptoIndexId} (Crypto)`);

  console.log("\n==========================================================");
  console.log("2. REGISTERING OANDA METALS IN SYMBOLS & INDEX_CONSTITUENTS");
  console.log("==========================================================");

  for (const metal of OANDA_METALS) {
    await pool.query(
      `INSERT INTO \`symbols\` (symbol, company_name, exchange)
       VALUES (?, ?, 'METALS')
       ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), exchange = 'METALS'`,
      [metal.symbol, metal.name]
    );

    await pool.query(
      `INSERT IGNORE INTO \`index_constituents\` (symbol, index_id) VALUES (?, ?)`,
      [metal.symbol, metalsIndexId]
    );
    console.log(`✓ Registered ${metal.symbol} (${metal.name}) as METALS in symbols and index_constituents (Index ID ${metalsIndexId})`);
  }

  console.log("\n==========================================================");
  console.log("3. CREATING / RESETTING TEMP METALS TABLE");
  console.log("==========================================================");

  await pool.query(`
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
  `);

  await pool.query("TRUNCATE TABLE `temp_metals_data`");
  console.log("✓ Created and truncated `temp_metals_data`");

  console.log("\n==========================================================");
  console.log("4. FETCHING ALL HISTORICAL CANDLES FOR OANDA METALS");
  console.log("==========================================================");

  const allFilteredRecords = [];

  for (const metal of OANDA_METALS) {
    console.log(`\n--- Fetching full history for ${metal.symbol} ---`);
    let rawCandles = [];
    let toTimestamp = undefined;
    let batchIndex = 0;

    while (true) {
      batchIndex++;
      try {
        const fetchOpts = {
          symbol: metal.symbol,
          timeframe: "D",
          count: 10000,
        };
        if (toTimestamp) {
          fetchOpts.to = toTimestamp;
        }

        const batch = await getCandles(fetchOpts);
        if (!batch || batch.length === 0) {
          console.log(`Batch ${batchIndex}: 0 candles returned. Reached beginning of data.`);
          break;
        }

        const earliestBatchDate = new Date(batch[0].time * 1000).toISOString().slice(0, 10);
        const latestBatchDate = new Date(batch[batch.length - 1].time * 1000).toISOString().slice(0, 10);
        console.log(`Batch ${batchIndex}: fetched ${batch.length} candles (range: ${earliestBatchDate} to ${latestBatchDate})`);

        rawCandles = batch.concat(rawCandles);
        const earliestTime = batch[0].time;
        toTimestamp = earliestTime - 1;

        if (batch.length < 500) {
          console.log(`Batch ${batchIndex} returned fewer than 500 candles (${batch.length}). End of stream.`);
          break;
        }
      } catch (err) {
        if (err.code === "NO_DATA" || (err.message && err.message.includes("No candles available"))) {
          console.log(`Batch ${batchIndex}: Reached earliest available historical data (${err.message})`);
          break;
        }
        console.error(`Error in batch ${batchIndex} for ${metal.symbol}:`, err.message);
        break;
      }
    }

    console.log(`Total raw candles fetched for ${metal.symbol}: ${rawCandles.length}`);

    // Filter weekends and holidays
    let weekendCount = 0;
    let holidayCount = 0;
    let duplicateCount = 0;
    const cleanCandles = [];
    const seenDates = new Set();

    for (const c of rawCandles) {
      if (!c || c.time == null || c.close == null) continue;

      // OANDA session opens at 21:00 or 22:00 UTC Sunday-Thursday evening.
      // Offset by 4 hours (+14400s) to map session open timestamp into the actual trading date.
      const d = new Date((c.time + 14400) * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat

      if (dow === 0 || dow === 6) {
        weekendCount++;
        continue;
      }

      const indHol = isIndianMarketHoliday(dateStr);
      const metHol = isMetalsMarketHoliday(dateStr);
      if (indHol.isHoliday || metHol.isHoliday) {
        holidayCount++;
        continue;
      }

      if (seenDates.has(dateStr)) {
        duplicateCount++;
        continue;
      }
      seenDates.add(dateStr);

      const open = Number(Number(c.open).toFixed(4));
      const high = Number(Number(c.high).toFixed(4));
      const low = Number(Number(c.low).toFixed(4));
      const close = Number(Number(c.close).toFixed(4));
      const adjClose = close;
      const volume = Number(c.volume ?? 0);

      // Validate price points
      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;

      cleanCandles.push({
        symbol: metal.symbol,
        date: dateStr,
        open,
        high,
        low,
        close,
        adj_close: adjClose,
        volume,
      });
    }

    console.log(`Filtered summary for ${metal.symbol}:`);
    console.log(`  - Raw Candles: ${rawCandles.length}`);
    console.log(`  - Weekends Excluded: ${weekendCount}`);
    console.log(`  - Holidays Excluded: ${holidayCount}`);
    console.log(`  - Duplicates: ${duplicateCount}`);
    console.log(`  - Clean Valid Candles: ${cleanCandles.length}`);
    if (cleanCandles.length > 0) {
      console.log(`  - Earliest Clean Date: ${cleanCandles[0].date}`);
      console.log(`  - Latest Clean Date: ${cleanCandles[cleanCandles.length - 1].date}`);
    }

    allFilteredRecords.push(...cleanCandles);
  }

  console.log("\n==========================================================");
  console.log(`5. INSERTING CLEAN METALS DATA INTO TEMP TABLE (${allFilteredRecords.length} records)`);
  console.log("==========================================================");

  const chunkSize = 500;
  for (let i = 0; i < allFilteredRecords.length; i += chunkSize) {
    const chunk = allFilteredRecords.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = [];
    for (const r of chunk) {
      values.push(r.symbol, r.date, r.open, r.high, r.low, r.close, r.adj_close, r.volume);
    }
    await pool.query(
      `INSERT INTO \`temp_metals_data\` (symbol, date, open, high, low, close, adj_close, volume)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         open = VALUES(open),
         high = VALUES(high),
         low = VALUES(low),
         close = VALUES(close),
         adj_close = VALUES(adj_close),
         volume = VALUES(volume)`,
      values
    );
  }
  console.log(`✓ Inserted ${allFilteredRecords.length} records into \`temp_metals_data\``);

  console.log("\n==========================================================");
  console.log(`6. INSERTING CLEAN METALS DATA INTO GLOBAL_ASSETS TABLE`);
  console.log("==========================================================");

  // Clear existing OANDA metals records from global_assets to replace with full clean history
  const oandaSymbols = OANDA_METALS.map((m) => m.symbol);
  await pool.query(
    `DELETE FROM \`global_assets\` WHERE symbol IN (${oandaSymbols.map(() => "?").join(", ")})`,
    oandaSymbols
  );
  console.log(`✓ Cleared previous ${oandaSymbols.join(", ")} records from \`global_assets\``);

  for (let i = 0; i < allFilteredRecords.length; i += chunkSize) {
    const chunk = allFilteredRecords.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = [];
    for (const r of chunk) {
      values.push(r.symbol, r.date, r.open, r.high, r.low, r.close, r.adj_close, r.volume);
    }
    await pool.query(
      `INSERT INTO \`global_assets\` (symbol, date, open, high, low, close, adj_close, volume)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         open = VALUES(open),
         high = VALUES(high),
         low = VALUES(low),
         close = VALUES(close),
         adj_close = VALUES(adj_close),
         volume = VALUES(volume)`,
      values
    );
  }
  console.log(`✓ Inserted ${allFilteredRecords.length} records into \`global_assets\``);

  console.log("\n==========================================================");
  console.log("7. FINAL VERIFICATION & RECORD COUNTS");
  console.log("==========================================================");

  const [tempSummary] = await pool.query(
    `SELECT symbol, COUNT(*) AS count, MIN(date) AS start_date, MAX(date) AS end_date
     FROM temp_metals_data
     GROUP BY symbol`
  );
  console.log("temp_metals_data Summary:");
  console.table(tempSummary);

  const [gaSummary] = await pool.query(
    `SELECT symbol, COUNT(*) AS count, MIN(date) AS start_date, MAX(date) AS end_date
     FROM global_assets
     WHERE symbol IN ('OANDA:XAUUSD', 'OANDA:XAGUSD', 'DELTAIN:PAXGUSD.P', 'DELTAIN:XAUTUSD.P', 'DELTAIN:SLVONUSD.P')
     GROUP BY symbol`
  );
  console.log("global_assets Summary:");
  console.table(gaSummary);

  const [symbolsSummary] = await pool.query(
    `SELECT symbol, company_name, exchange
     FROM symbols
     WHERE symbol IN ('OANDA:XAUUSD', 'OANDA:XAGUSD', 'DELTAIN:PAXGUSD.P', 'DELTAIN:XAUTUSD.P', 'DELTAIN:SLVONUSD.P')`
  );
  console.log("symbols Table Summary:");
  console.table(symbolsSummary);

  const [icSummary] = await pool.query(
    `SELECT c.symbol, c.index_id, i.index_name
     FROM index_constituents c
     JOIN indices i ON c.index_id = i.index_id
     WHERE c.symbol IN ('OANDA:XAUUSD', 'OANDA:XAGUSD', 'DELTAIN:PAXGUSD.P', 'DELTAIN:XAUTUSD.P', 'DELTAIN:SLVONUSD.P')`
  );
  console.log("index_constituents Table Summary:");
  console.table(icSummary);

  console.log("\n✅ All operations completed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
