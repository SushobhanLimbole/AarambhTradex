import { apiClient } from "./apiClient";

/**
 * End-of-Day (EOD) Data Synchronization Service
 */
export const eodSyncService = {
  /**
   * Get live cron status, last run timestamps, and job execution metrics
   */
  getStatus: async () => {
    return await apiClient("/api/sync/status");
  },

  /**
   * Manually trigger Indian Market EOD sync (NSE & BSE)
   * @param {Object} params - { date?: string, limit?: number }
   */
  triggerIndianSync: async (params = {}) => {
    return await apiClient("/api/sync/indian", {
      method: "POST",
      body: params,
    });
  },

  /**
   * Manually trigger Global Assets EOD sync (Crypto & Metals)
   * @param {Object} params - { date?: string }
   */
  triggerGlobalSync: async (params = {}) => {
    return await apiClient("/api/sync/global", {
      method: "POST",
      body: params,
    });
  },

  /**
   * Manually trigger 30-day corporate actions & stock split reconciliation
   * @param {Object} params - { days?: number, limit?: number }
   */
  triggerReconciliation: async (params = {}) => {
    return await apiClient("/api/sync/reconcile", {
      method: "POST",
      body: params,
    });
  },
};

export default eodSyncService;
