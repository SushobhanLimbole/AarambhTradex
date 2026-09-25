import pool from "../config/mysql.js";

async function migrateMissingSymbols() {
  console.log("🚀 Starting migration from missing_symbols to historical_candles...");
  const conn = await pool.getConnection();

  try {
    // 1. Get initial counts
    const [[{ count: initialMissing }]] = await conn.query("SELECT COUNT(*) as count FROM missing_symbols");
    const [[{ count: initialHistorical }]] = await conn.query("SELECT COUNT(*) as count FROM historical_candles");
    console.log(`📊 Initial historical_candles row count: ${initialHistorical.toLocaleString()}`);
    console.log(`📊 Total missing_symbols rows to migrate: ${initialMissing.toLocaleString()}`);

    // 2. Fetch distinct symbols from missing_symbols
    const [symbolRows] = await conn.query("SELECT DISTINCT symbol FROM missing_symbols ORDER BY symbol ASC");
    const symbols = symbolRows.map(r => r.symbol);
    console.log(`📋 Found ${symbols.length} unique symbols in missing_symbols.`);

    let totalMigratedRows = 0;
    let successSymbols = 0;
    let startTime = Date.now();

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      
      const [result] = await conn.query(
        `INSERT INTO historical_candles (symbol, date, open, high, low, close, volume)
         SELECT symbol, date, open, high, low, close, volume
         FROM missing_symbols
         WHERE symbol = ?
         ON DUPLICATE KEY UPDATE
           open = VALUES(open),
           high = VALUES(high),
           low = VALUES(low),
           close = VALUES(close),
           volume = VALUES(volume)`,
        [sym]
      );

      // result.affectedRows indicates inserted + updated rows
      totalMigratedRows += (result.affectedRows || 0);
      successSymbols++;

      if ((i + 1) % 25 === 0 || (i + 1) === symbols.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const percent = (((i + 1) / symbols.length) * 100).toFixed(1);
        console.log(`⏳ Progress: [${i + 1}/${symbols.length}] (${percent}%) | Processed: ${sym} | Elapsed: ${elapsed}s`);
      }
    }

    // 3. Final Verification
    const [[{ count: finalHistorical }]] = await conn.query("SELECT COUNT(*) as count FROM historical_candles");
    console.log("\n==========================================");
    console.log("✅ Migration completed successfully!");
    console.log(`📈 New historical_candles row count: ${finalHistorical.toLocaleString()} (+${(finalHistorical - initialHistorical).toLocaleString()} new rows)`);
    console.log(`✨ Successfully migrated data for all ${successSymbols} symbols.`);
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrateMissingSymbols();
