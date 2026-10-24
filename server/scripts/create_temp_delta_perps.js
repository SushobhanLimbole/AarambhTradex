import fs from "fs";
import path from "path";
import pool from "../src/config/mysql.js";

const DELTA_SYMBOLS = [
  "DELTAIN:PAXGUSD.P",
  "DELTAIN:XAUTUSD.P",
  "DELTAIN:SLVONUSD.P",
];

async function createAndDumpTempDeltaPerps() {
  console.log("=== 1. CREATING TEMP_DELTA_PERPS_DATA TABLE ===");
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS \`temp_delta_perps_data\` (
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
  await pool.query(createTableSql);
  await pool.query("TRUNCATE TABLE `temp_delta_perps_data`");
  console.log("✓ Created and truncated `temp_delta_perps_data` table");

  console.log("\n=== 2. POPULATING FROM GLOBAL_ASSETS ===");
  const placeholders = DELTA_SYMBOLS.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO \`temp_delta_perps_data\` (\`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`adj_close\`, \`volume\`)
     SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`adj_close\`, \`volume\`
     FROM \`global_assets\`
     WHERE \`symbol\` IN (${placeholders})
     ORDER BY \`symbol\` ASC, \`date\` ASC`,
    DELTA_SYMBOLS
  );

  const [summary] = await pool.query(
    `SELECT symbol, COUNT(*) AS count, MIN(date) AS start_date, MAX(date) AS end_date
     FROM temp_delta_perps_data
     GROUP BY symbol`
  );
  console.log("temp_delta_perps_data Summary:");
  console.table(summary);

  console.log("\n=== 3. GENERATING SQL DUMP FILE FOR VPS MERGE ===");
  const [createRows] = await pool.query("SHOW CREATE TABLE `temp_delta_perps_data`");
  const createSql = createRows[0]["Create Table"] + ";\n\n";

  const [rows] = await pool.query("SELECT * FROM `temp_delta_perps_data`");
  let insertSql = "";
  if (rows.length > 0) {
    const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ");
    const chunkSize = 250;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valStrings = chunk.map((row) => {
        const vals = Object.values(row).map((v) => {
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return v;
          return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
        });
        return `(${vals.join(", ")})`;
      });
      insertSql += `INSERT INTO \`temp_delta_perps_data\` (${cols}) VALUES\n${valStrings.join(",\n")};\n\n`;
    }
  }

  const mergeSql = `
-- ==============================================================================
-- AUTOMATIC MERGE QUERY INTO global_assets ON VPS:
-- ==============================================================================
INSERT INTO \`global_assets\` (\`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`adj_close\`, \`volume\`)
SELECT \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`adj_close\`, \`volume\`
FROM \`temp_delta_perps_data\`
ON DUPLICATE KEY UPDATE
  \`open\` = VALUES(\`open\`),
  \`high\` = VALUES(\`high\`),
  \`low\` = VALUES(\`low\`),
  \`close\` = VALUES(\`close\`),
  \`adj_close\` = VALUES(\`adj_close\`),
  \`volume\` = VALUES(\`volume\`);
`;

  const dumpDir = path.resolve("..", "dumps");
  if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

  const filePath = path.join(dumpDir, "temp_delta_perps_data.sql");
  fs.writeFileSync(
    filePath,
    `-- Dump of table temp_delta_perps_data\n-- Symbols: ${DELTA_SYMBOLS.join(", ")}\n-- Generated on: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS = 0;\nSET UNIQUE_CHECKS = 0;\n\nDROP TABLE IF EXISTS \`temp_delta_perps_data\`;\n\n` +
      createSql +
      insertSql +
      mergeSql +
      `\nSET UNIQUE_CHECKS = 1;\nSET FOREIGN_KEY_CHECKS = 1;\n`
  );

  const stats = fs.statSync(filePath);
  console.log(`✓ Dump file created successfully: ${filePath} (${(stats.size / 1024).toFixed(1)} KB, ${rows.length} rows)`);

  process.exit(0);
}

createAndDumpTempDeltaPerps().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
