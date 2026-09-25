import pool from "../config/mysql.js";

export class SymbolMetadataModel {
  /**
   * Get distinct metadata filters (exchanges, indices, count) for lightning-fast dropdown rendering
   * Sourced directly from normalized relational tables: symbols, indices, index_constituents
   */
  static async getFilters() {
    // 1. Get distinct exchanges
    const [exchangesRows] = await pool.query(
      `SELECT DISTINCT exchange FROM symbols WHERE exchange IS NOT NULL AND exchange != '' ORDER BY exchange ASC`
    );

    // 2. Get distinct indices with constituent counts
    const [indicesRows] = await pool.query(
      `SELECT i.index_name, COUNT(DISTINCT ic.symbol) as count 
       FROM indices i 
       JOIN index_constituents ic ON i.index_id = ic.index_id 
       GROUP BY i.index_id, i.index_name 
       ORDER BY i.index_name ASC`
    );

    // 3. Get total distinct symbols count
    const [countRow] = await pool.query(`SELECT COUNT(*) as total FROM symbols`);

    return {
      exchanges: exchangesRows.map((r) => r.exchange),
      indices: indicesRows.map((r) => r.index_name),
      indicesWithCounts: indicesRows.map((r) => ({
        name: r.index_name,
        count: r.count,
        label: `${r.index_name.toUpperCase()} (${r.count} stocks)`,
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

    let query = `
      SELECT 
        s.symbol, 
        s.company_name, 
        s.exchange, 
        GROUP_CONCAT(DISTINCT i.index_name ORDER BY i.index_name SEPARATOR ', ') as indice
      FROM symbols s
      LEFT JOIN index_constituents ic ON s.symbol = ic.symbol
      LEFT JOIN indices i ON ic.index_id = i.index_id
      WHERE 1=1
    `;
    const params = [];

    if (exchange && exchange !== "ALL" && exchange !== "All Exchanges") {
      query += ` AND s.exchange = ?`;
      params.push(exchange);
    }

    if (indice && indice !== "ALL" && indice !== "All Indices") {
      query += ` AND s.symbol IN (
        SELECT ic_filter.symbol 
        FROM index_constituents ic_filter 
        JOIN indices i_filter ON ic_filter.index_id = i_filter.index_id 
        WHERE LOWER(i_filter.index_name) = LOWER(?)
      )`;
      params.push(indice);
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      query += ` AND (
        s.symbol LIKE ? 
        OR s.company_name LIKE ? 
        OR s.symbol IN (
          SELECT ic_search.symbol 
          FROM index_constituents ic_search 
          JOIN indices i_search ON ic_search.index_id = i_search.index_id 
          WHERE i_search.index_name LIKE ?
        )
      )`;
      params.push(term, term, term);
    }

    query += ` GROUP BY s.symbol, s.company_name, s.exchange`;

    const sortOrder = String(order).toUpperCase() === "DESC" ? "DESC" : "ASC";
    query += ` ORDER BY s.symbol ${sortOrder}`;

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
    if (!symbol) return null;
    const cleanSym = String(symbol).trim().toUpperCase();
    const query = `
      SELECT 
        s.symbol, 
        s.company_name, 
        s.exchange, 
        GROUP_CONCAT(DISTINCT i.index_name ORDER BY i.index_name SEPARATOR ', ') as indice
      FROM symbols s
      LEFT JOIN index_constituents ic ON s.symbol = ic.symbol
      LEFT JOIN indices i ON ic.index_id = i.index_id
      WHERE s.symbol = ? OR s.symbol = ?
      GROUP BY s.symbol, s.company_name, s.exchange
      LIMIT 1
    `;
    const [rows] = await pool.query(query, [cleanSym, `${cleanSym}.NS`]);
    return rows[0] || null;
  }

  /**
   * Find a symbol record by primary key identifier / symbol
   */
  static async findById(id) {
    return await this.findBySymbol(id);
  }

  /**
   * Create a new symbol metadata record
   */
  static async create(data) {
    const { symbol, exchange = "NSE", indice = "Other", company_name = null } = data;
    const cleanSym = symbol.trim().toUpperCase();
    const cleanExch = exchange.trim().toUpperCase();

    await pool.query(
      `INSERT INTO symbols (symbol, company_name, exchange) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), exchange = VALUES(exchange)`,
      [cleanSym, company_name, cleanExch]
    );

    if (indice) {
      // Find or create index
      let [idxRows] = await pool.query(`SELECT index_id FROM indices WHERE index_name = ? LIMIT 1`, [indice]);
      let indexId = idxRows[0]?.index_id;
      if (!indexId) {
        const [insertRes] = await pool.query(`INSERT INTO indices (index_name) VALUES (?)`, [indice]);
        indexId = insertRes.insertId;
      }
      await pool.query(
        `INSERT IGNORE INTO index_constituents (symbol, index_id) VALUES (?, ?)`,
        [cleanSym, indexId]
      );
    }

    return await this.findBySymbol(cleanSym);
  }

  /**
   * Update an existing symbol record
   */
  static async update(id, data) {
    const symbol = String(id).trim().toUpperCase();
    const { exchange, company_name, indice } = data;

    const updates = [];
    const params = [];

    if (exchange !== undefined) {
      updates.push(`exchange = ?`);
      params.push(exchange);
    }
    if (company_name !== undefined) {
      updates.push(`company_name = ?`);
      params.push(company_name);
    }

    if (updates.length > 0) {
      params.push(symbol);
      await pool.query(`UPDATE symbols SET ${updates.join(", ")} WHERE symbol = ?`, params);
    }

    if (indice) {
      let [idxRows] = await pool.query(`SELECT index_id FROM indices WHERE index_name = ? LIMIT 1`, [indice]);
      let indexId = idxRows[0]?.index_id;
      if (!indexId) {
        const [insertRes] = await pool.query(`INSERT INTO indices (index_name) VALUES (?)`, [indice]);
        indexId = insertRes.insertId;
      }
      await pool.query(`INSERT IGNORE INTO index_constituents (symbol, index_id) VALUES (?, ?)`, [symbol, indexId]);
    }

    return await this.findBySymbol(symbol);
  }

  /**
   * Delete a symbol record
   */
  static async delete(id) {
    const symbol = String(id).trim().toUpperCase();
    await pool.query(`DELETE FROM index_constituents WHERE symbol = ?`, [symbol]);
    const [result] = await pool.query(`DELETE FROM symbols WHERE symbol = ?`, [symbol]);
    return result.affectedRows > 0;
  }
}

export default SymbolMetadataModel;
