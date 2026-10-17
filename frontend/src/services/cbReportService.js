import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

export const cbReportService = {
  /**
   * Fetch CB (Ordinary CB & CB with Status) institutional report
   * @param {Object} params - { exchange, indice, timeframe, actionDate, filterType }
   */
  async getCbReport(params = {}, options = {}) {
    const query = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") query.append("exchange", params.exchange);
    if (params.indice && params.indice !== "ALL") query.append("indice", params.indice);
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.actionDate) query.append("actionDate", params.actionDate);
    if (params.filterType && params.filterType !== "ALL") query.append("filterType", params.filterType);

    const url = `${ENDPOINTS.CB_REPORT.SCAN}?${query.toString()}`;
    return await apiClient(url, {
      method: "GET",
      ...options,
    });
  },
};

export default cbReportService;
