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
   * @param {Object} options - { symbols, startDate, endDate, limit = 'all', order }
   */
  async getAllStocks(timeframe = "Daily", options = {}) {
    const params = new URLSearchParams({
      timeframe,
      ...(options.symbols && { symbols: Array.isArray(options.symbols) ? options.symbols.join(",") : options.symbols }),
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
  async getLatestAllStocks(timeframe = "Daily") {
    return await apiClient(`${ENDPOINTS.STOCKS.GET_LATEST_ALL}?timeframe=${encodeURIComponent(timeframe)}`, {
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
};

export default stockService;
