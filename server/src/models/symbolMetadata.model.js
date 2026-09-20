import pool from "../config/mysql.js";

const TABLE_NAME = "symbols_metadata";

export class SymbolMetadataModel {
  /**
   * Get distinct metadata filters (exchanges, indices, count) for lightning-fast dropdown rendering
   */
  static async getFilters() {
    // 1. Get distinct exchanges
    const [exchangesRows] = await pool.query(
      `SELECT DISTINCT exchange FROM ${TABLE_NAME} WHERE exchange IS NOT NULL AND exchange != '' ORDER BY exchange ASC`
    );

    // 2. Get distinct indices with counts
    const [indicesRows] = await pool.query(
      `SELECT indice, COUNT(*) as count FROM ${TABLE_NAME} WHERE indice IS NOT NULL AND indice != '' GROUP BY indice ORDER BY indice ASC`
    );

    // 3. Get total count
    const [countRow] = await pool.query(`SELECT COUNT(*) as total FROM ${TABLE_NAME}`);

    return {
      exchanges: exchangesRows.map((r) => r.exchange),
      indices: indicesRows.map((r) => r.indice),
      indicesWithCounts: indicesRows.map((r) => ({
        name: r.indice,
        count: r.count,
        label: `${r.indice.toUpperCase()} (${r.count} stocks)`,
      })),
      totalSymbols: countRow[0]?.total || 0,
    };
  }

  /**
   * Find all symbols matching query filters
   * @param {Object} options - { exchange, indice, search, limit, offset, order }
   */
  static async findAll(options = {}) {
    const { exchange, indice, search, limit, offset = 0, order = "ASC" } = options;

    let query = `SELECT id, symbol, exchange, indice, company_name, total_candles, first_date, last_date, is_active, created_at, updated_at FROM ${TABLE_NAME} WHERE 1=1`;
    const params = [];

    if (exchange && exchange !== "ALL" && exchange !== "All Exchanges") {
      query += ` AND exchange = ?`;
      params.push(exchange);
    }

    if (indice && indice !== "ALL" && indice !== "All Indices") {
      query += ` AND indice = ?`;
      params.push(indice);
    }

    if (search && search.trim() !== "") {
      query += ` AND (symbol LIKE ? OR company_name LIKE ? OR indice LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const sortOrder = String(order).toUpperCase() === "DESC" ? "DESC" : "ASC";
    query += ` ORDER BY symbol ${sortOrder}`;

    if (limit !== undefined && limit !== "all" && limit !== "ALL" && !isNaN(Number(limit))) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));
    }

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Find a symbol record by its ticker symbol
   */
  static async findBySymbol(symbol) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE_NAME} WHERE symbol = ? LIMIT 1`, [symbol]);
    return rows[0] || null;
  }

  /**
   * Find a symbol record by primary key ID
   */
  static async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  /**
   * Create a new symbol metadata record
   */
  static async create(data) {
    const { symbol, exchange = "NSE", indice = null, company_name = null, total_candles = 0 } = data;
    const [result] = await pool.query(
      `INSERT INTO ${TABLE_NAME} (symbol, exchange, indice, company_name, total_candles) VALUES (?, ?, ?, ?, ?)`,
      [symbol.trim().toUpperCase(), exchange.trim().toUpperCase(), indice, company_name, total_candles]
    );
    return await this.findById(result.insertId);
  }

  /**
   * Update an existing symbol metadata record
   */
  static async update(id, data) {
    const allowed = ["symbol", "exchange", "indice", "company_name", "total_candles", "first_date", "last_date", "is_active"];
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (updates.length === 0) return await this.findById(id);

    params.push(id);
    await pool.query(`UPDATE ${TABLE_NAME} SET ${updates.join(", ")} WHERE id = ?`, params);
    return await this.findById(id);
  }

  /**
   * Delete a symbol metadata record
   */
  static async delete(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  }
}

export default SymbolMetadataModel;
