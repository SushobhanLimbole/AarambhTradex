import pool from "../config/mysql.js";

/**
 * Stock Data Model for MySQL
 * 
 * Table Schema:
 * id       INT AUTO_INCREMENT PRIMARY KEY
 * symbol   VARCHAR(50)
 * date     DATE NOT NULL
 * open     DECIMAL(15,4)
 * high     DECIMAL(15,4)
 * low      DECIMAL(15,4)
 * close    DECIMAL(15,4)
 * volume   BIGINT
 */

const DEFAULT_TABLE_NAME = process.env.MYSQL_STOCK_TABLE || "historical_candles";

export const GLOBAL_SYMBOLS = new Set([
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
  "XRP-USD",
  "XAUUSD=X",
  "XAGUSD=X",
]);

export function isGlobalAsset(symbol, exchange) {
  if (exchange) {
    const ex = String(exchange).toUpperCase();
    if (ex === "CRYPTO" || ex === "METALS") return true;
  }
  if (symbol && GLOBAL_SYMBOLS.has(String(symbol).trim().toUpperCase())) {
    return true;
  }
  return false;
}

export function resolveTableName(exchange, symbol, defaultTable = DEFAULT_TABLE_NAME) {
  if (exchange) {
    const ex = String(exchange).toUpperCase();
    if (ex === "CRYPTO" || ex === "METALS") return "global_assets";
    if (ex === "NSE" || ex === "BSE") return "historical_candles";
  }
  if (symbol) {
    const sym = String(symbol).trim().toUpperCase();
    if (GLOBAL_SYMBOLS.has(sym)) return "global_assets";
  }
  return defaultTable;
}

export class StockDataModel {
  static tableName = DEFAULT_TABLE_NAME;

  /**
   * Helper to check if limit is requested as 'all' / unlimited
   */
  static isLimitAll(limit) {
    if (limit === null || limit === undefined || limit === false) return false;
    if (typeof limit === "string") {
      const s = limit.trim().toLowerCase();
      return s === "all" || s === "0" || s === "-1" || s === "unlimited" || s === "max";
    }
    if (typeof limit === "number") {
      return limit <= 0;
    }
    return false;
  }

  /**
   * Initialize table if it does not exist
   */
  static async initTable(tableName = this.tableName) {
    const query = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`symbol\` VARCHAR(50) DEFAULT NULL,
        \`date\` DATE NOT NULL,
        \`open\` DECIMAL(15,4) DEFAULT NULL,
        \`high\` DECIMAL(15,4) DEFAULT NULL,
        \`low\` DECIMAL(15,4) DEFAULT NULL,
        \`close\` DECIMAL(15,4) DEFAULT NULL,
        \`volume\` BIGINT DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_symbol_date\` (\`symbol\`, \`date\`),
        KEY \`idx_candle_sym_date\` (\`symbol\`, \`date\` DESC),
        KEY \`idx_candle_date\` (\`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    const [result] = await pool.query(query);
    return result;
  }

  /* =========================================================================
     1. CREATE METHODS
     ========================================================================= */

  /**
   * Create a single stock price record
   * @param {Object} data - { symbol, date, open, high, low, close, volume }
   * @returns {Promise<Object>} Inserted record with id
   */
  static async create(data, tableName = this.tableName) {
    const { symbol, date, open, high, low, close, volume } = data;
    const query = `
      INSERT INTO \`${tableName}\` (\`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [
      symbol || null,
      date,
      open !== undefined ? open : null,
      high !== undefined ? high : null,
      low !== undefined ? low : null,
      close !== undefined ? close : null,
      volume !== undefined ? volume : null,
    ]);

    return {
      id: result.insertId,
      symbol,
      date,
      open: open !== null && open !== undefined ? Number(open) : null,
      high: high !== null && high !== undefined ? Number(high) : null,
      low: low !== null && low !== undefined ? Number(low) : null,
      close: close !== null && close !== undefined ? Number(close) : null,
      volume: volume !== null && volume !== undefined ? Number(volume) : null,
    };
  }

  /**
   * Bulk insert or upsert stock price records
   * @param {Array<Object>} records - Array of { symbol, date, open, high, low, close, volume }
   * @param {Object} options - { updateOnDuplicate: boolean }
   * @returns {Promise<Object>} MySQL result metadata
   */
  static async bulkCreate(records, { updateOnDuplicate = true } = {}, tableName = this.tableName) {
    if (!records || records.length === 0) return { affectedRows: 0 };

    const values = [];
    const placeholders = [];

    for (const r of records) {
      placeholders.push("(?, ?, ?, ?, ?, ?, ?)");
      values.push(
        r.symbol || null,
        r.date,
        r.open !== undefined ? r.open : null,
        r.high !== undefined ? r.high : null,
        r.low !== undefined ? r.low : null,
        r.close !== undefined ? r.close : null,
        r.volume !== undefined ? r.volume : null
      );
    }

    let query = `
      INSERT INTO \`${tableName}\` (\`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`)
      VALUES ${placeholders.join(", ")}
    `;

    if (updateOnDuplicate) {
      query += `
        ON DUPLICATE KEY UPDATE
          \`open\` = VALUES(\`open\`),
          \`high\` = VALUES(\`high\`),
          \`low\` = VALUES(\`low\`),
          \`close\` = VALUES(\`close\`),
          \`volume\` = VALUES(\`volume\`)
      `;
    }

    const [result] = await pool.query(query, values);
    return result;
  }

  /* =========================================================================
     2. READ / RETRIEVAL METHODS (SYMBOL SPECIFIC & NON-SPECIFIC)
     ========================================================================= */

  /**
   * Find a single record by primary key id
   * @param {number|string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id, tableName = this.tableName) {
    const query = `SELECT * FROM \`${tableName}\` WHERE \`id\` = ? LIMIT 1`;
    const [rows] = await pool.execute(query, [id]);
    return rows.length > 0 ? this._formatRow(rows[0]) : null;
  }

  /**
   * Find raw daily records by symbol with optional filters and pagination
   * Supports limit = 'all' for fetching all records.
   * @param {string} symbol
   * @param {Object} options - { startDate, endDate, limit, offset, order, exchange }
   */
  static async findBySymbol(symbol, options = {}, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(options.exchange, symbol, tableName) : tableName;
    const {
      startDate,
      endDate,
      limit = 1000,
      offset = 0,
      order = "DESC",
    } = options;

    const conditions = ["`symbol` = ?"];
    const params = [symbol];

    if (startDate) {
      conditions.push("`date` >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("`date` <= ?");
      params.push(endDate);
    }

    const sortOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";
    const isAll = this.isLimitAll(limit);

    let query = `
      SELECT * FROM \`${effectiveTable}\`
      WHERE ${conditions.join(" AND ")}
      ORDER BY \`date\` ${sortOrder}
    `;

    if (!isAll) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));
    }

    const [rows] = await pool.query(query, params);
    return rows.map((r) => this._formatRow(r));
  }

  /**
   * Find raw daily records across ALL stock symbols (Non-symbol specific)
   * Supports limit = 'all' for unlimited row retrieval.
   * Joins with symbols, indices, and index_constituents when filtering by exchange or indice.
   * @param {Object} options - { symbols, exchange, indice, startDate, endDate, limit, offset, order }
   */
  static async findAll(options = {}, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(options.exchange, null, tableName) : tableName;
    const {
      symbols,
      exchange,
      indice,
      startDate,
      endDate,
      limit = 1000,
      offset = 0,
      order = "DESC",
    } = options;

    const conditions = [];
    const params = [];
    let joins = "";

    const hasExchangeFilter = exchange && String(exchange).toUpperCase() !== "ALL";
    const hasIndiceFilter = indice && String(indice).toUpperCase() !== "ALL";

    if (hasExchangeFilter || hasIndiceFilter) {
      joins += " JOIN `symbols` s ON t.`symbol` = s.`symbol`";
    }

    if (hasExchangeFilter) {
      conditions.push("s.`exchange` = ?");
      params.push(exchange);
    }

    if (hasIndiceFilter) {
      conditions.push(`t.\`symbol\` IN (
        SELECT ic.symbol 
        FROM index_constituents ic 
        JOIN indices i ON ic.index_id = i.index_id 
        WHERE LOWER(i.index_name) = LOWER(?)
      )`);
      params.push(indice);
    }

    if (symbols) {
      const symList = Array.isArray(symbols)
        ? symbols
        : String(symbols).split(",").map((s) => s.trim()).filter(Boolean);
      if (symList.length > 0) {
        conditions.push(`t.\`symbol\` IN (${symList.map(() => "?").join(", ")})`);
        params.push(...symList);
      }
    }

    if (startDate) {
      conditions.push("t.`date` >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("t.`date` <= ?");
      params.push(endDate);
    }

    const sortOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const isAll = this.isLimitAll(limit);

    let query = `
      SELECT t.\`id\`, t.\`symbol\`, t.\`date\`, t.\`open\`, t.\`high\`, t.\`low\`, t.\`close\`, t.\`volume\`
      FROM \`${effectiveTable}\` t
      ${joins}
      ${whereClause}
      ORDER BY t.\`date\` ${sortOrder}, t.\`symbol\` ASC
    `;

    if (!isAll) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));
    }

    const [rows] = await pool.query(query, params);
    return rows.map((r) => this._formatRow(r));
  }

  /**
   * Get all distinct symbols present in the database
   */
  static async getAllSymbols(tableName = this.tableName) {
    const query = `SELECT DISTINCT \`symbol\` FROM \`${tableName}\` WHERE \`symbol\` IS NOT NULL ORDER BY \`symbol\` ASC`;
    const [rows] = await pool.query(query);
    return rows.map((r) => r.symbol);
  }

  /**
   * Get the latest record for a symbol
   */
  static async getLatestBySymbol(symbol, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(null, symbol, tableName) : tableName;
    const query = `
      SELECT * FROM \`${effectiveTable}\`
      WHERE \`symbol\` = ?
      ORDER BY \`date\` DESC
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [symbol]);
    return rows.length > 0 ? this._formatRow(rows[0]) : null;
  }

  /* =========================================================================
     3. TIMEFRAME-BASED RESAMPLED RETRIEVAL (SYMBOL SPECIFIC & ALL STOCKS)
     ========================================================================= */

  /**
   * Retrieve OHLCV data for a SPECIFIC symbol aggregated by timeframe
   * Supports limit = 'all' for unlimited row retrieval.
   *
   * @param {string} symbol - Stock symbol (e.g., 'NIFTY', 'RELIANCE.NS')
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @param {Object} options - { startDate, endDate, limit, order = 'DESC', exchange }
   * @returns {Promise<Array<Object>>} Aggregated OHLCV candle records
   */
  static async findByTimeframe(symbol, timeframe = "Daily", options = {}, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(options.exchange, symbol, tableName) : tableName;
    const { startDate, endDate, limit = 500, order = "DESC" } = options;
    const tf = String(timeframe).trim();
    const isAll = this.isLimitAll(limit);

    // 1. If timeframe is Daily, fetch directly
    if (tf.toLowerCase() === "daily") {
      return await this.findBySymbol(
        symbol,
        { startDate, endDate, limit, offset: 0, order, exchange: options.exchange },
        effectiveTable
      );
    }

    // 2. For Higher Timeframes (Weekly, Monthly, Quarterly, Half-Yearly, Yearly, 5-Yearly):
    const conditions = ["`symbol` = ?"];
    const params = [symbol];

    if (startDate) {
      conditions.push("`date` >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("`date` <= ?");
      params.push(endDate);
    }

    const dailyQuery = `
      SELECT \`id\`, \`symbol\`, \`date\`, \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`
      FROM \`${effectiveTable}\`
      WHERE ${conditions.join(" AND ")}
      ORDER BY \`date\` ASC
    `;

    const [dailyRows] = await pool.query(dailyQuery, params);
    if (!dailyRows || dailyRows.length === 0) {
      return [];
    }

    // Resample daily rows into requested timeframe buckets
    const resampled = this.resampleCandles(dailyRows, tf);

    // Apply sorting order
    const isAsc = String(order).toUpperCase() === "ASC";
    const sorted = isAsc ? resampled : resampled.reverse();

    // Apply limit if specified and not 'all'
    return isAll ? sorted : sorted.slice(0, Number(limit));
  }

  /**
   * Retrieve OHLCV data across ALL stock symbols (Non-symbol specific) aggregated by timeframe
   * Supports limit = 'all' for unlimited row retrieval.
   *
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @param {Object} options - { symbols, exchange, indice, startDate, endDate, limit = 1000, order = 'DESC' }
   * @returns {Promise<Array<Object>>} Aggregated OHLCV candle records across stocks
   */
  static async findAllByTimeframe(timeframe = "Daily", options = {}, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(options.exchange, null, tableName) : tableName;
    const { symbols, exchange, indice, startDate, endDate, limit = 1000, order = "DESC" } = options;
    const tf = String(timeframe).trim();
    const isAll = this.isLimitAll(limit);

    // If Daily, fetch directly
    if (tf.toLowerCase() === "daily") {
      return await this.findAll(
        { symbols, exchange, indice, startDate, endDate, limit, offset: 0, order },
        effectiveTable
      );
    }

    // For higher timeframes, fetch all underlying daily records in ASC order
    const conditions = [];
    const params = [];
    let joins = "";

    const hasExchangeFilter = exchange && String(exchange).toUpperCase() !== "ALL";
    const hasIndiceFilter = indice && String(indice).toUpperCase() !== "ALL";

    if (hasExchangeFilter || hasIndiceFilter) {
      joins += " JOIN `symbols` s ON t.`symbol` = s.`symbol`";
    }

    if (hasExchangeFilter) {
      conditions.push("s.`exchange` = ?");
      params.push(exchange);
    }

    if (hasIndiceFilter) {
      conditions.push(`t.\`symbol\` IN (
        SELECT ic.symbol 
        FROM index_constituents ic 
        JOIN indices i ON ic.index_id = i.index_id 
        WHERE LOWER(i.index_name) = LOWER(?)
      )`);
      params.push(indice);
    }

    if (symbols) {
      const symList = Array.isArray(symbols)
        ? symbols
        : String(symbols).split(",").map((s) => s.trim()).filter(Boolean);
      if (symList.length > 0) {
        conditions.push(`t.\`symbol\` IN (${symList.map(() => "?").join(", ")})`);
        params.push(...symList);
      }
    }

    if (startDate) {
      conditions.push("t.`date` >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("t.`date` <= ?");
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT t.\`id\`, t.\`symbol\`, t.\`date\`, t.\`open\`, t.\`high\`, t.\`low\`, t.\`close\`, t.\`volume\`
      FROM \`${effectiveTable}\` t
      ${joins}
      ${whereClause}
      ORDER BY t.\`symbol\` ASC, t.\`date\` ASC
    `;

    const [dailyRows] = await pool.query(query, params);
    if (!dailyRows || dailyRows.length === 0) return [];

    // Group rows by symbol
    const groupedBySymbol = {};
    for (const row of dailyRows) {
      const sym = row.symbol || "UNKNOWN";
      if (!groupedBySymbol[sym]) {
        groupedBySymbol[sym] = [];
      }
      groupedBySymbol[sym].push(row);
    }

    // Resample each symbol
    let allResampled = [];
    for (const sym of Object.keys(groupedBySymbol)) {
      const symbolBars = this.resampleCandles(groupedBySymbol[sym], tf);
      allResampled.push(...symbolBars);
    }

    // Sort combined results by date and symbol
    const isAsc = String(order).toUpperCase() === "ASC";
    allResampled.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return isAsc ? cmp : -cmp;
      return (a.symbol || "").localeCompare(b.symbol || "");
    });

    if (isAll) {
      return allResampled;
    }
    return allResampled.slice(0, Number(limit));
  }

  /**
   * Get today's / latest trading session candles for all symbols (matching the latest date only)
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @param {Object} options - { date, exchange, indice }
   */
  static async getLatestAllSymbols(timeframe = "Daily", options = {}, tableName = this.tableName) {
    const effectiveTable = tableName === this.tableName ? resolveTableName(options.exchange, null, tableName) : tableName;
    const { date } = options;

    if (String(timeframe).toLowerCase() === "daily") {
      let targetDate = date;
      if (!targetDate) {
        // Find the latest trading date in the table
        const query = `SELECT MAX(\`date\`) as maxDate FROM \`${effectiveTable}\``;
        const [res] = await pool.query(query);
        targetDate = res[0]?.maxDate;
      }

      if (!targetDate) return [];

      const dateStr = typeof targetDate === "string"
        ? targetDate.slice(0, 10)
        : new Date(targetDate).toISOString().slice(0, 10);

      const conditions = ["t.`date` = ?"];
      const params = [dateStr];
      let joins = "";

      const hasExchangeFilter = options.exchange && String(options.exchange).toUpperCase() !== "ALL";
      const hasIndiceFilter = options.indice && String(options.indice).toUpperCase() !== "ALL";

      if (hasExchangeFilter || hasIndiceFilter) {
        joins += " JOIN `symbols` s ON t.`symbol` = s.`symbol`";
      }

      if (hasExchangeFilter) {
        conditions.push("s.`exchange` = ?");
        params.push(options.exchange);
      }

      if (hasIndiceFilter) {
        conditions.push(`t.\`symbol\` IN (
          SELECT ic.symbol 
          FROM index_constituents ic 
          JOIN indices i ON ic.index_id = i.index_id 
          WHERE LOWER(i.index_name) = LOWER(?)
        )`);
        params.push(options.indice);
      }

      const query = `
        SELECT t.* FROM \`${effectiveTable}\` t
        ${joins}
        WHERE ${conditions.join(" AND ")}
        ORDER BY t.\`symbol\` ASC
      `;
      const [rows] = await pool.query(query, params);
      return rows.map((r) => this._formatRow(r));
    }

    // For higher timeframes, get candles for the latest time bucket only
    const allCandles = await this.findAllByTimeframe(timeframe, { limit: "all", order: "DESC", exchange: options.exchange, indice: options.indice }, effectiveTable);
    if (!allCandles || allCandles.length === 0) return [];

    const latestBucket = allCandles[0]?.bucket || allCandles[0]?.date;
    return allCandles.filter((c) => (c.bucket || c.date) === latestBucket);
  }

  /**
   * Resamples an array of chronological daily bars into higher timeframe bars
   * @param {Array<Object>} dailyRecords - Array of daily bars in ASC date order
   * @param {string} timeframe - 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @returns {Array<Object>} Aggregated bars
   */
  static resampleCandles(dailyRecords, timeframe) {
    if (!dailyRecords || dailyRecords.length === 0) return [];

    const buckets = new Map();

    for (const row of dailyRecords) {
      const dateStr = typeof row.date === "string" ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10);
      const [yearStr, monthStr, dayStr] = dateStr.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10); // 1-12
      const day = parseInt(dayStr, 10);
      const rowDate = new Date(Date.UTC(year, month - 1, day));

      let bucketKey = "";
      let bucketLabel = "";

      switch (timeframe) {
        case "Weekly": {
          const isoYear = this._getISOWeekYear(rowDate);
          const isoWeek = this._getISOWeek(rowDate);
          bucketKey = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
          bucketLabel = bucketKey;
          break;
        }

        case "Monthly": {
          bucketKey = `${yearStr}-${String(month).padStart(2, "0")}`;
          bucketLabel = bucketKey;
          break;
        }

        case "Quarterly": {
          const quarter = Math.floor((month - 1) / 3) + 1; // 1, 2, 3, 4
          bucketKey = `${yearStr}-Q${quarter}`;
          bucketLabel = `${yearStr} Q${quarter}`;
          break;
        }

        case "Half-Yearly": {
          const half = month <= 6 ? "H1" : "H2"; // H1: Jan-Jun, H2: Jul-Dec
          bucketKey = `${yearStr}-${half}`;
          bucketLabel = `${yearStr} ${half}`;
          break;
        }

        case "Yearly": {
          bucketKey = `${yearStr}`;
          bucketLabel = `${yearStr}`;
          break;
        }

        case "5-Yearly": {
          const startFiveYear = Math.floor(year / 5) * 5;
          const endFiveYear = startFiveYear + 4;
          bucketKey = `${startFiveYear}-${endFiveYear}`;
          bucketLabel = `${startFiveYear}-${endFiveYear}`;
          break;
        }

        default: // Default fallback to daily
          bucketKey = dateStr;
          bucketLabel = dateStr;
          break;
      }

      const openVal = Number(row.open) || 0;
      const highVal = Number(row.high) || 0;
      const lowVal = Number(row.low) || 0;
      const closeVal = Number(row.close) || 0;
      const volumeVal = Number(row.volume) || 0;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          symbol: row.symbol,
          timeframe,
          bucketKey,
          bucketLabel,
          startDate: dateStr,
          date: dateStr,
          endDate: dateStr,
          open: openVal,
          high: highVal,
          low: lowVal,
          close: closeVal,
          volume: volumeVal,
          count: 1,
        });
      } else {
        const bucket = buckets.get(bucketKey);
        bucket.high = Math.max(bucket.high, highVal);
        bucket.low = Math.min(bucket.low, lowVal);
        bucket.close = closeVal; // Last day's close in chronological stream
        bucket.volume += volumeVal;
        bucket.endDate = dateStr;
        bucket.date = dateStr;
        bucket.count += 1;
      }
    }

    return Array.from(buckets.values()).map((b) => ({
      symbol: b.symbol,
      timeframe: b.timeframe,
      period: b.bucketLabel,
      date: b.date,
      startDate: b.startDate,
      endDate: b.endDate,
      open: Number(b.open.toFixed(4)),
      high: Number(b.high.toFixed(4)),
      low: Number(b.low.toFixed(4)),
      close: Number(b.close.toFixed(4)),
      volume: b.volume,
      candlesCount: b.count,
    }));
  }

  /* =========================================================================
     4. UPDATE METHODS (ID, SYMBOL, OR MULTI-STOCK CRITERIA)
     ========================================================================= */

  /**
   * Update a stock record by ID
   * @param {number|string} id
   * @param {Object} updateData - Fields to update: { open, high, low, close, volume, date, symbol }
   */
  static async updateById(id, updateData, tableName = this.tableName) {
    const allowed = ["symbol", "date", "open", "high", "low", "close", "volume"];
    const setClauses = [];
    const values = [];

    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        setClauses.push(`\`${key}\` = ?`);
        values.push(updateData[key]);
      }
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    const query = `UPDATE \`${tableName}\` SET ${setClauses.join(", ")} WHERE \`id\` = ?`;
    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) return null;
    return await this.findById(id, tableName);
  }

  /**
   * Update a stock record by Symbol and Date
   */
  static async updateBySymbolAndDate(symbol, date, updateData, tableName = this.tableName) {
    const allowed = ["open", "high", "low", "close", "volume"];
    const setClauses = [];
    const values = [];

    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        setClauses.push(`\`${key}\` = ?`);
        values.push(updateData[key]);
      }
    }

    if (setClauses.length === 0) return null;

    values.push(symbol, date);
    const query = `UPDATE \`${tableName}\` SET ${setClauses.join(", ")} WHERE \`symbol\` = ? AND \`date\` = ?`;
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Update records across stocks by filter criteria (Non-symbol specific)
   * @param {Object} criteria - { symbols, startDate, endDate }
   * @param {Object} updateData - { open, high, low, close, volume }
   */
  static async updateAll(criteria = {}, updateData = {}, tableName = this.tableName) {
    const allowed = ["open", "high", "low", "close", "volume"];
    const setClauses = [];
    const values = [];

    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        setClauses.push(`\`${key}\` = ?`);
        values.push(updateData[key]);
      }
    }

    if (setClauses.length === 0) return 0;

    const conditions = [];
    if (criteria.symbols) {
      const symList = Array.isArray(criteria.symbols)
        ? criteria.symbols
        : String(criteria.symbols).split(",").map((s) => s.trim()).filter(Boolean);
      if (symList.length > 0) {
        conditions.push(`\`symbol\` IN (${symList.map(() => "?").join(", ")})`);
        values.push(...symList);
      }
    }
    if (criteria.startDate) {
      conditions.push("`date` >= ?");
      values.push(criteria.startDate);
    }
    if (criteria.endDate) {
      conditions.push("`date` <= ?");
      values.push(criteria.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `UPDATE \`${tableName}\` SET ${setClauses.join(", ")} ${whereClause}`;
    const [result] = await pool.query(query, values);
    return result.affectedRows;
  }

  /* =========================================================================
     5. DELETE METHODS (ID, SYMBOL, OR MULTI-STOCK CRITERIA)
     ========================================================================= */

  /**
   * Delete a record by ID
   * @param {number|string} id
   */
  static async deleteById(id, tableName = this.tableName) {
    const query = `DELETE FROM \`${tableName}\` WHERE \`id\` = ?`;
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Delete all records for a symbol
   * @param {string} symbol
   */
  static async deleteBySymbol(symbol, tableName = this.tableName) {
    const query = `DELETE FROM \`${tableName}\` WHERE \`symbol\` = ?`;
    const [result] = await pool.execute(query, [symbol]);
    return result.affectedRows;
  }

  /**
   * Delete records for a symbol within a date range
   */
  static async deleteBySymbolAndDateRange(symbol, startDate, endDate, tableName = this.tableName) {
    const query = `DELETE FROM \`${tableName}\` WHERE \`symbol\` = ? AND \`date\` >= ? AND \`date\` <= ?`;
    const [result] = await pool.execute(query, [symbol, startDate, endDate]);
    return result.affectedRows;
  }

  /**
   * Delete records across ALL stocks matching criteria (or all records)
   * @param {Object} criteria - { symbols, startDate, endDate }
   */
  static async deleteAll(criteria = {}, tableName = this.tableName) {
    const conditions = [];
    const params = [];

    if (criteria.symbols) {
      const symList = Array.isArray(criteria.symbols)
        ? criteria.symbols
        : String(criteria.symbols).split(",").map((s) => s.trim()).filter(Boolean);
      if (symList.length > 0) {
        conditions.push(`\`symbol\` IN (${symList.map(() => "?").join(", ")})`);
        params.push(...symList);
      }
    }
    if (criteria.startDate) {
      conditions.push("`date` >= ?");
      params.push(criteria.startDate);
    }
    if (criteria.endDate) {
      conditions.push("`date` <= ?");
      params.push(criteria.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `DELETE FROM \`${tableName}\` ${whereClause}`;
    const [result] = await pool.query(query, params);
    return result.affectedRows;
  }

  /* =========================================================================
     6. INTERNAL HELPERS
     ========================================================================= */

  static _formatRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      symbol: row.symbol,
      date: typeof row.date === "string" ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10),
      open: row.open !== null ? Number(row.open) : null,
      high: row.high !== null ? Number(row.high) : null,
      low: row.low !== null ? Number(row.low) : null,
      close: row.close !== null ? Number(row.close) : null,
      volume: row.volume !== null ? Number(row.volume) : null,
    };
  }

  static _getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  static _getISOWeekYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    return d.getUTCFullYear();
  }
}

export default StockDataModel;
