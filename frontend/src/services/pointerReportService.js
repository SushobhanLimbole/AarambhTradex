import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Service for Pointer Report API
 */
export const pointerReportService = {
  /**
   * Fetch Pointer Report data
   * @param {Object} params - { exchange, indice, timeframe, actionDate, search }
   */
  async getPointerReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.exchange && params.exchange !== "ALL") {
      searchParams.append("exchange", params.exchange);
    }
    if (params.indice && params.indice !== "ALL") {
      searchParams.append("indice", params.indice);
    }
    if (params.timeframe) {
      searchParams.append("timeframe", params.timeframe);
    }
    if (params.actionDate) {
      searchParams.append("actionDate", params.actionDate);
    }
    if (params.search) {
      searchParams.append("search", params.search);
    }

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return await apiClient(`${ENDPOINTS.POINTER_REPORT.SCAN}${qs}`, {
      method: "GET",
    });
  },
};

export default pointerReportService;
