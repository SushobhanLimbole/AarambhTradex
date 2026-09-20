import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

export const abTopBottomService = {
  /**
   * Fetch AB TOP & BELOW BOTTOM institutional report
   * @param {Object} params - { exchange, indice, timeframe, actionDate, filterType }
   */
  async getAbTopBottomReport(params = {}) {
    const query = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") query.append("exchange", params.exchange);
    if (params.indice && params.indice !== "ALL") query.append("indice", params.indice);
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.actionDate) query.append("actionDate", params.actionDate);
    if (params.filterType && params.filterType !== "ALL") query.append("filterType", params.filterType);

    const url = `${ENDPOINTS.AB_TOP_BOTTOM.SCAN}?${query.toString()}`;
    return await apiClient(url, {
      method: "GET",
    });
  },
};

export default abTopBottomService;
