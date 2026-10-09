import fs from "fs";
import path from "path";
import pool from "../src/config/mysql.js";

async function dumpTable(tableName) {
  const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
  const createSql = createRows[0]["Create Table"] + ";\n\n";

  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
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
      insertSql += `INSERT INTO \`${tableName}\` (${cols}) VALUES\n${valStrings.join(",\n")};\n\n`;
    }
  }

  const dumpDir = path.resolve("..", "dumps");
  if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
  const filePath = path.join(dumpDir, `${tableName}.sql`);
  fs.writeFileSync(
    filePath,
    `-- Dump of table ${tableName}\n-- Generated on: ${new Date().toISOString()}\n\nDROP TABLE IF EXISTS \`${tableName}\`;\n\n` +
      createSql +
      insertSql
  );
  const stats = fs.statSync(filePath);
  console.log(`✓ Successfully dumped ${tableName} (${rows.length} rows, ${(stats.size / 1024).toFixed(1)} KB) -> ${filePath}`);
}

async function run() {
  console.log("Starting database table dump...");
  await dumpTable("global_assets");
  await dumpTable("symbols");
  await dumpTable("index_constituents");
  console.log("All table dumps completed successfully.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Dump error:", err);
  process.exit(1);
});
