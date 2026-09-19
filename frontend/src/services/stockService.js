import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Frontend Stock Service for fetching timeframe-aggregated stock data and performing CRUD
 * Supports both Symbol-Specific and Non-Symbol-Specific (All Stocks) operations, with limit='all'
 */
export const stockService = {
  /**
   * Get stock data across ALL stocks resampled by timeframe
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @param {Object} options - { symbols, exchange, indice, startDate, endDate, limit = 'all', order }
   */
  async getAllStocks(timeframe = "Daily", options = {}) {
    const params = new URLSearchParams({
      timeframe,
      ...(options.symbols && { symbols: Array.isArray(options.symbols) ? options.symbols.join(",") : options.symbols }),
      ...(options.exchange && options.exchange !== "ALL" && { exchange: options.exchange }),
      ...(options.indice && options.indice !== "ALL" && { indice: options.indice }),
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
      ...(options.limit !== undefined && { limit: options.limit }),
      ...(options.order && { order: options.order }),
    });

    return await apiClient(`${ENDPOINTS.STOCKS.GET_ALL}?${params.toString()}`, {
      method: "GET",
    });
  },

  /**
   * Get latest candle for every symbol in the database
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   */
  async getLatestAllStocks(timeframe = "Daily", date) {
    const params = new URLSearchParams({ timeframe });
    if (date) params.append("date", date);
    return await apiClient(`${ENDPOINTS.STOCKS.GET_LATEST_ALL}?${params.toString()}`, {
      method: "GET",
    });
  },

  /**
   * Get stock data for a SPECIFIC symbol resampled by timeframe
   * @param {string} symbol - e.g. 'NIFTY', 'BANKNIFTY', 'RELIANCE'
   * @param {string} timeframe - 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | '5-Yearly'
   * @param {Object} options - { startDate, endDate, limit = 'all', order }
   */
  async getStockData(symbol, timeframe = "Daily", options = {}) {
    const params = new URLSearchParams({
      timeframe,
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
      ...(options.limit !== undefined && { limit: options.limit }),
      ...(options.order && { order: options.order }),
    });

    return await apiClient(`${ENDPOINTS.STOCKS.GET_BY_TIMEFRAME(symbol)}?${params.toString()}`, {
      method: "GET",
    });
  },

  /**
   * Get list of all available stock symbols
   */
  async getSymbols() {
    return await apiClient(ENDPOINTS.STOCKS.GET_SYMBOLS, {
      method: "GET",
    });
  },

  /**
   * Create a single stock record
   */
  async createStockData(stockData) {
    return await apiClient(ENDPOINTS.STOCKS.CREATE, {
      method: "POST",
      body: stockData,
    });
  },

  /**
   * Bulk insert or upsert stock records across any symbols
   */
  async bulkCreateStockData(records, updateOnDuplicate = true) {
    return await apiClient(ENDPOINTS.STOCKS.BULK_CREATE, {
      method: "POST",
      body: { records, updateOnDuplicate },
    });
  },

  /**
   * Update a stock record by ID
   */
  async updateStockData(id, updateData) {
    return await apiClient(ENDPOINTS.STOCKS.UPDATE(id), {
      method: "PUT",
      body: updateData,
    });
  },

  /**
   * Update records across multiple stocks by criteria (Non-symbol specific)
   * @param {Object} criteria - { symbols, startDate, endDate }
   * @param {Object} updateData - { open, high, low, close, volume }
   */
  async updateMultipleStocks(criteria, updateData) {
    return await apiClient(ENDPOINTS.STOCKS.UPDATE_ALL, {
      method: "PUT",
      body: { criteria, updateData },
    });
  },

  /**
   * Delete a stock record by ID
   */
  async deleteStockData(id) {
    return await apiClient(ENDPOINTS.STOCKS.DELETE(id), {
      method: "DELETE",
    });
  },

  /**
   * Delete all records for a specific symbol
   */
  async deleteStockDataBySymbol(symbol, { startDate, endDate } = {}) {
    const params = new URLSearchParams({
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient(`${ENDPOINTS.STOCKS.DELETE_BY_SYMBOL(symbol)}${qs}`, {
      method: "DELETE",
    });
  },

  /**
   * Delete stock records across ALL stocks matching criteria (Non-symbol specific)
   * @param {Object} criteria - { symbols, startDate, endDate }
   */
  async deleteAllStocks(criteria = {}) {
    const params = new URLSearchParams({
      ...(criteria.symbols && { symbols: Array.isArray(criteria.symbols) ? criteria.symbols.join(",") : criteria.symbols }),
      ...(criteria.startDate && { startDate: criteria.startDate }),
      ...(criteria.endDate && { endDate: criteria.endDate }),
    });
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient(`${ENDPOINTS.STOCKS.DELETE_ALL}${qs}`, {
      method: "DELETE",
    });
  },

  /* =========================================================================
     SYMBOLS METADATA & FILTER CRUD APIS
     ========================================================================= */

  /**
   * High-speed metadata retrieval (Distinct exchanges, distinct indices, total counts)
   */
  async getSymbolsMeta() {
    return await apiClient(ENDPOINTS.SYMBOLS.GET_META, {
      method: "GET",
    });
  },

  /**
   * Fetch symbols list with filtering options
   * @param {Object} options - { exchange, indice, search, limit = 'all', offset, order }
   */
  async getSymbolsList(options = {}) {
    const params = new URLSearchParams({
      ...(options.exchange && options.exchange !== "ALL" && { exchange: options.exchange }),
      ...(options.indice && options.indice !== "ALL" && { indice: options.indice }),
      ...(options.search && { search: options.search }),
      ...(options.limit !== undefined && { limit: options.limit }),
      ...(options.offset !== undefined && { offset: options.offset }),
      ...(options.order && { order: options.order }),
    });
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient(`${ENDPOINTS.SYMBOLS.GET_ALL}${qs}`, {
      method: "GET",
    });
  },

  /**
   * Get single symbol metadata by ID or symbol string
   */
  async getSymbolById(id) {
    return await apiClient(ENDPOINTS.SYMBOLS.GET_BY_ID(id), {
      method: "GET",
    });
  },

  /**
   * Create a new symbol metadata record
   */
  async createSymbol(symbolData) {
    return await apiClient(ENDPOINTS.SYMBOLS.CREATE, {
      method: "POST",
      body: symbolData,
    });
  },

  /**
   * Update an existing symbol metadata record
   */
  async updateSymbol(id, symbolData) {
    return await apiClient(ENDPOINTS.SYMBOLS.UPDATE(id), {
      method: "PUT",
      body: symbolData,
    });
  },

  /**
   * Delete a symbol metadata record
   */
  async deleteSymbol(id) {
    return await apiClient(ENDPOINTS.SYMBOLS.DELETE(id), {
      method: "DELETE",
    });
  },
};

export default stockService;
