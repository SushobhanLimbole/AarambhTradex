import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

export const trendReportService = {
  /**
   * Fetch New Trend Report (Trend Scanner)
   * @param {Object} params - { exchange, indice, timeframe, actionDate, mode }
   */
  async getTrendReport(params = {}) {
    const query = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") query.append("exchange", params.exchange);
    if (params.indice && params.indice !== "ALL") query.append("indice", params.indice);
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.actionDate) query.append("actionDate", params.actionDate);
    if (params.mode) query.append("mode", params.mode);

    const url = `${ENDPOINTS.TREND_REPORT.SCAN}?${query.toString()}`;
    return await apiClient(url, {
      method: "GET",
    });
  },
};

export default trendReportService;
