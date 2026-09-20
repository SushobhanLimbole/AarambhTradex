import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

export const highestClosingService = {
  /**
   * Fetch Highest Closing institutional report
   * @param {Object} params - { exchange, indice, timeframe, actionDate, filterType, ytdStartDate }
   */
  async getHighestClosingReport(params = {}) {
    const query = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") query.append("exchange", params.exchange);
    if (params.indice && params.indice !== "ALL") query.append("indice", params.indice);
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.actionDate) query.append("actionDate", params.actionDate);
    if (params.filterType && params.filterType !== "ALL") query.append("filterType", params.filterType);
    if (params.ytdStartDate) query.append("ytdStartDate", params.ytdStartDate);

    const url = `${ENDPOINTS.HIGHEST_CLOSING.SCAN}?${query.toString()}`;
    return await apiClient(url, {
      method: "GET",
    });
  },
};

export default highestClosingService;
