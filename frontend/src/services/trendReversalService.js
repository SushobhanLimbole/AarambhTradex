import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

export const trendReversalService = {
  /**
   * Fetch Trend Reversal (Bullish & Bearish) institutional report
   * @param {Object} params - { exchange, indice, timeframe, actionDate, reversalType }
   */
  async getTrendReversalReport(params = {}) {
    const query = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") query.append("exchange", params.exchange);
    if (params.indice && params.indice !== "ALL") query.append("indice", params.indice);
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.actionDate) query.append("actionDate", params.actionDate);
    if (params.reversalType && params.reversalType !== "ALL") query.append("reversalType", params.reversalType);

    const url = `${ENDPOINTS.TREND_REVERSAL.SCAN}?${query.toString()}`;
    return await apiClient(url, {
      method: "GET",
    });
  },
};

export default trendReversalService;
