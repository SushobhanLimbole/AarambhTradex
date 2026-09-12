import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Strategy Access Service for user access requests and admin reviews
 */
export const strategyAccessService = {
  /**
   * User requests access to trading strategy
   */
  async requestAccess() {
    return await apiClient(ENDPOINTS.STRATEGY_ACCESS.REQUEST, {
      method: "POST",
    });
  },

  /**
   * User fetches their strategy access request status
   */
  async getMyStatus() {
    return await apiClient(ENDPOINTS.STRATEGY_ACCESS.STATUS, {
      method: "GET",
    });
  },

  /**
   * Admin fetches all access requests
   */
  async getAllRequests(status) {
    const url = status
      ? `${ENDPOINTS.STRATEGY_ACCESS.ADMIN_REQUESTS}?status=${encodeURIComponent(status)}`
      : ENDPOINTS.STRATEGY_ACCESS.ADMIN_REQUESTS;

    return await apiClient(url, {
      method: "GET",
    });
  },

  /**
   * Admin reviews (accept/decline) an access request
   */
  async reviewAccessRequest(requestId, action, adminNote = "") {
    return await apiClient(ENDPOINTS.STRATEGY_ACCESS.REVIEW_REQUEST(requestId), {
      method: "PATCH",
      body: { action, adminNote },
    });
  },
};

export default strategyAccessService;
