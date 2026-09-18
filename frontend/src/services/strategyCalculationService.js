import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Service for fetching confidential strategy decision engine calculations from backend API
 */
export const strategyCalculationService = {
  /**
   * Fetch calculated strategy triggers & scenarios from backend API
   * @param {Object} payload - { open, high, low, close, symbol, date, timeframe }
   * @returns {Promise<Object>} Strategy data payload from server
   */
  async calculateStrategy(payload) {
    try {
      return await apiClient(ENDPOINTS.STRATEGY.CALCULATE, {
        method: "POST",
        body: payload,
      });
    } catch (err) {
      // If access is forbidden (403), rethrow to trigger access barrier UI
      if (err.statusCode === 403 || err.status === 403) {
        throw err;
      }
      console.warn("Backend strategy API offline, fallback to preview calculations:", err.message);
      
      // Client-side fallback computation for preview / offline demo
      const o = parseFloat(payload.open) || 0;
      const h = parseFloat(payload.high) || 0;
      const l = parseFloat(payload.low) || 0;
      const c = parseFloat(payload.close) || 0;
      const range = (payload.range !== undefined && payload.range !== null && !isNaN(parseFloat(payload.range)) && parseFloat(payload.range) > 0)
        ? parseFloat(payload.range)
        : Math.max(0, h - l);

      const average = (payload.average !== undefined && payload.average !== null && !isNaN(parseFloat(payload.average)) && parseFloat(payload.average) > 0)
        ? parseFloat(payload.average)
        : ((h + l + c) / 3);

      const risingUpper = {
        38.2: c + range * 0.4721,
        61.8: c + range * 0.764,
        100: c + range * 1.1039,
        127.2: c + range * 1.4042,
        161.8: c + range * 2.0,
        261.8: c + range * 3.236,
      };

      const fallingLower = {
        38.2: c - range * 0.4721,
        61.8: c - range * 0.764,
        100: c - range * 1.1039,
        127.2: c - range * 1.4042,
        161.8: c - range * 2.0,
        261.8: c - range * 3.236,
      };

      const Y1 = Number(((c + risingUpper[38.2]) / 2).toFixed(2));
      const Y2 = Number(((c + risingUpper[61.8]) / 2).toFixed(2));
      const Y3 = Number(((c + risingUpper[100]) / 2).toFixed(2));
      const Y4 = Number(((c + risingUpper[127.2]) / 2).toFixed(2));
      const Y5 = Number(((c + risingUpper[161.8]) / 2).toFixed(2));
      const Y6 = Number(((c + risingUpper[261.8]) / 2).toFixed(2));

      const R1 = Number(((c + fallingLower[100]) / 2).toFixed(2));
      const R2 = Number(((c + fallingLower[61.8]) / 2).toFixed(2));
      const R3 = Number(((c + fallingLower[38.2]) / 2).toFixed(2));
      const R4 = Number(((c + fallingLower[127.2]) / 2).toFixed(2));
      const R5 = Number(((c + fallingLower[161.8]) / 2).toFixed(2));
      const R6 = Number(((c + fallingLower[261.8]) / 2).toFixed(2));

      const G1 = Number(((Y1 + R1) / 2).toFixed(2));
      const G2 = Number(((Y2 + R2) / 2).toFixed(2));
      const G3 = Number(((Y3 + R3) / 2).toFixed(2));

      return {
        success: true,
        hasAccess: true,
        symbol: payload.symbol || "CUSTOM",
        triggers: {
          yellow: { Y1, Y2, Y3, Y4, Y5, Y6 },
          red: { R1, R2, R3, R4, R5, R6 },
          green: { G1, G2, G3, G4: G2, G5: G2, G6: G2 },
          displayTable: {
            yellow: [Y1, Y2, Y3, Y4, Y5, Y6],
            green: [G1, G2, G3],
            red: [R5, R4, R1, R2, R3, R6],
          },
        },
        conditions: {
          high: "Above FC 14.6 & Below RC 14.6.",
          low: "Above FC 100 & Below FC 61.8.",
          lowCheck2: "FALSE",
          close: "Above FC 14.6 & Below RC 14.6.",
          scenario: "UPWARD ROTATION",
          highLow: "Above FC 38.2 & Below FC 23.6.",
          lowClose: "Above FC 14.6 & Below RC 14.6.",
        },
        scenarios: [
          {
            id: "selling_pointer",
            name: "SELLING POINTER",
            theme: "green",
            isMultiline: false,
            yellow: { code: "Y1", channel: "RC 23.6", value: Y1 },
            red: { code: "R1", channel: "FC 61.8", value: R1 },
            green: { code: "G1", channel: "FC 14.6", value: G1 },
          },
          {
            id: "table_tennis",
            name: "TABLE TENNIS",
            theme: "blue",
            isMultiline: false,
            yellow: { code: "Y2", channel: "RC 38.2", value: Y2 },
            red: { code: "R2", channel: "FC 38.2", value: R2 },
            green: { code: "G2", channel: "CLOSE", value: G2 },
          },
          {
            id: "buying_pointer",
            name: "BUYING POINTER",
            theme: "green",
            isMultiline: false,
            yellow: { code: "Y3", channel: "RC 61.8", value: Y3 },
            red: { code: "R3", channel: "FC 23.6", value: R3 },
            green: { code: "G3", channel: "RC 14.6", value: G3 },
          },
          {
            id: "rising_falling_breakout_1",
            name: "RISING - FALLING BREAKOUT",
            subtitle: "T- TOP - UPWARD BREAKDOWN",
            bottomLabel: "CLOSE PRICE",
            theme: "blue",
            isMultiline: true,
            yellow: { code: "Y4", channel: "RC 61.8+", value: Y4 },
            red: { code: "R4", channel: "RC 61.8-", value: R4 },
            green: { code: "G2", channel: "CLOSE", value: G2 },
          },
          {
            id: "rising_falling_breakout_2",
            name: "RISING - FALLING BREAKOUT",
            subtitle: "T- TOP - UPWARD BREAKDOWN",
            bottomLabel: "CLOSE PRICE",
            theme: "sage",
            isMultiline: true,
            yellow: { code: "Y5", channel: "RC 100", value: Y5 },
            red: { code: "R5", channel: "FC 100", value: R5 },
            green: { code: "G2", channel: "CLOSE", value: G2 },
          },
        ],
      };
    }
  },
};

export default strategyCalculationService;
