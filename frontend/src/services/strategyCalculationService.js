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

      const risingMain = {
        14.6: c + range * 0.146,
        23.6: c + range * 0.236,
        38.2: c + range * 0.382,
        61.8: c + range * 0.618,
        100: c + range * 1.0,
      };

      const fallingMain = {
        14.6: c - range * 0.146,
        23.6: c - range * 0.236,
        38.2: c - range * 0.382,
        61.8: c - range * 0.618,
        100: c - range * 1.0,
      };

      const evalBand = (price) => {
        if (price >= fallingMain[14.6] && price <= risingMain[14.6]) return "Above FC 14.6 & Below RC 14.6.";
        if (price > risingMain[14.6] && price <= risingMain[23.6]) return "Above RC 14.6 & Below RC 23.6.";
        if (price > risingMain[23.6] && price <= risingMain[38.2]) return "Above RC 23.6 & Below RC 38.2.";
        if (price > risingMain[38.2] && price <= risingMain[61.8]) return "Above RC 38.2 & Below RC 61.8.";
        if (price > risingMain[61.8] && price <= risingMain[100]) return "Above RC 61.8 & Below RC 100.";
        if (price >= fallingMain[23.6] && price < fallingMain[14.6]) return "Above FC 23.6 & Below FC 14.6.";
        if (price >= fallingMain[38.2] && price < fallingMain[23.6]) return "Above FC 38.2 & Below FC 23.6.";
        if (price >= fallingMain[61.8] && price < fallingMain[38.2]) return "Above FC 61.8 & Below FC 38.2.";
        if (price >= fallingMain[100] && price < fallingMain[61.8]) return "Above FC 100 & Below FC 61.8.";
        return "FALSE";
      };

      const highCond = evalBand(h);
      const lowCond = evalBand(l);
      const evalScenario = (hVal, lVal, cVal) => {
        const rVal = Math.max(0, hVal - lVal);
        const rm14 = cVal + rVal * 0.146;
        const rm38 = cVal + rVal * 0.382;
        const rm61 = cVal + rVal * 0.618;
        const rm100 = cVal + rVal * 1.0;
        const fm14 = cVal - rVal * 0.146;
        const fm38 = cVal - rVal * 0.382;
        const fm61 = cVal - rVal * 0.618;
        const fm100 = cVal - rVal * 1.0;

        if (hVal > rm61 && hVal < rm100 && lVal < fm14 && lVal > fm38) return "Rising Jack";
        if (hVal > rm38 && hVal < rm61 && lVal < fm38 && lVal > fm61) return "Table Tennis";
        if (hVal > rm14 && hVal < rm38 && lVal < fm61 && lVal > fm100) return "Table Top";
        if (hVal > fm14 && hVal < rm14 && lVal > fm100 && lVal < fm61) return "Upward Rotation";
        if (hVal > rm61 && hVal < rm100 && lVal > fm14 && lVal < rm14) return "Falling Duck";
        return "FALSE";
      };

      let detectedScenario = evalScenario(h, l, c);
      if (detectedScenario === "FALSE") {
        detectedScenario = evalScenario(h + 0.05, l + 0.05, c);
      }

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
          high: highCond,
          low: lowCond,
          lowCheck2: "FALSE",
          close: evalBand(c),
          scenario: detectedScenario,
          highLow: evalBand((h + l) / 2),
          lowClose: evalBand((l + c) / 2),
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
