import pool from "../config/mysql.js";

/**
 * Get distinct symbols matching exchange and/or indice filters
 * Sourced directly from normalized relational tables: symbols, index_constituents, indices
 *
 * @param {Object} options - { exchange, indice }
 * @returns {Promise<Array<{ symbol: string, exchange: string }>>}
 */
export async function getFilteredSymbols({ exchange, indice } = {}) {
  const normExch = exchange ? String(exchange).trim().toUpperCase() : "ALL";
  const normInd = indice ? String(indice).trim() : "ALL";

  let query = `
    SELECT 
      s.symbol, 
      s.company_name, 
      s.exchange, 
      GROUP_CONCAT(DISTINCT i.index_name ORDER BY i.index_name SEPARATOR ', ') as indice
    FROM symbols s
    LEFT JOIN index_constituents ic ON s.symbol = ic.symbol
    LEFT JOIN indices i ON ic.index_id = i.index_id
  `;
  const params = [];
  const conditions = [];

  const hasExchangeFilter = normExch !== "ALL" && normExch !== "ALL EXCHANGES" && normExch !== "";
  const hasIndiceFilter = normInd !== "ALL" && normInd !== "ALL INDICES" && normInd !== "" && normInd.toUpperCase() !== "TOP 500";

  if (hasExchangeFilter) {
    conditions.push("s.exchange = ?");
    params.push(normExch);
  }

  if (hasIndiceFilter) {
    conditions.push("LOWER(i.index_name) = LOWER(?)");
    params.push(normInd);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " GROUP BY s.symbol, s.company_name, s.exchange ORDER BY s.symbol ASC";

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Determine the target candle table based on exchange or indice filter
 */
export function resolveMarketTable(exchange, indice) {
  const normExch = String(exchange || "").toUpperCase();
  const normInd = String(indice || "").toLowerCase();
  if (normExch === "CRYPTO" || normExch === "METALS" || normInd === "crypto" || normInd === "metals") {
    return "global_assets";
  }
  return process.env.MYSQL_HISTORICAL_TABLE || process.env.MYSQL_STOCK_TABLE || "historical_candles";
}

export default {
  getFilteredSymbols,
  resolveMarketTable,
};
