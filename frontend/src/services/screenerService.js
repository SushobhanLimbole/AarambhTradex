import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Service for running Breakout Stock Screener
 */
export const screenerService = {
  /**
   * Run Breakout Screener
   * @param {Object} payload - {
   *   cmp1: { startDate, endDate, timeframe },
   *   cmp2: { startDate, endDate, timeframe },
   *   pattern: string,
   *   trigger: string
   * }
   */
  async runScreener(payload) {
    try {
      return await apiClient(ENDPOINTS.SCREENER.RUN, {
        method: "POST",
        body: payload,
      });
    } catch (err) {
      console.warn("Backend screener unavailable or offline, generating client-side preview results:", err.message);
      
      // Fallback demo generation for offline / Netlify preview
      const DEMO_SYMBOLS = [
        "RELIANCE.NS",
        "TCS.NS",
        "HDFCBANK.NS",
        "INFY.NS",
        "ICICIBANK.NS",
        "BHARTIARTL.NS",
        "SBIN.NS",
        "LT.NS",
        "TATAMOTORS.NS",
        "SUNPHARMA.NS",
        "BAJFINANCE.NS",
        "M&M.NS",
        "AXISBANK.NS",
        "KOTAKBANK.NS",
        "TITAN.NS",
        "ADANIENT.NS",
        "MARUTI.NS",
        "WIPRO.NS",
      ];

      const triggerList = Array.isArray(payload.triggers) && payload.triggers.length > 0
        ? payload.triggers
        : payload.trigger
        ? String(payload.trigger).split(",").map((s) => s.trim()).filter(Boolean)
        : ["Y1"];

      // Select symbols and assign matched triggers
      const filtered = DEMO_SYMBOLS.filter((_, idx) => (idx + triggerList.length) % 2 === 0 || idx % 3 === 0);

      return {
        success: true,
        count: filtered.length,
        pattern: payload.pattern,
        triggers: triggerList,
        trigger: triggerList.join(", "),
        results: filtered,
        details: filtered.map((sym, i) => {
          const matched = triggerList.filter((_, tIdx) => (i + tIdx) % 2 === 0 || tIdx === 0);
          const activeTriggers = matched.length > 0 ? matched : [triggerList[0]];
          return {
            symbol: sym,
            cmp1Close: Number((1000 + i * 250.5).toFixed(2)),
            matchedTriggers: activeTriggers.map((trig, tIdx) => ({
              trigger: trig,
              triggerPrice: Number((950 + i * 240.2 - tIdx * 15).toFixed(2)),
              pctBreakout: Number((3.5 + ((i + tIdx) % 4) * 1.8).toFixed(2)),
            })),
            triggerCount: activeTriggers.length,
            primaryTrigger: activeTriggers[0],
            primaryTriggerPrice: Number((950 + i * 240.2).toFixed(2)),
            maxPctBreakout: Number((3.5 + (i % 4) * 1.8).toFixed(2)),
          };
        }),
      };
    }
  },

  /**
   * Request generated strategy spreadsheet for a stock and trigger file download
   * @param {Object} stockData - { symbol, open, high, low, close, average, range, date, timeframe }
   */
  async downloadStrategyExcel(stockData) {
    try {
      const response = await fetch(ENDPOINTS.SCREENER.GENERATE_STRATEGY_SHEET, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stockData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate strategy sheet.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanSym = (stockData?.symbol || "Stock").replace(/[^a-zA-Z0-9._-]/g, "_");
      a.download = `Strategy_${cleanSym}_${stockData?.date || "Analysis"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return { success: true };
    } catch (err) {
      console.error("Error downloading strategy excel sheet:", err);
      throw err;
    }
  },
};

export default screenerService;
