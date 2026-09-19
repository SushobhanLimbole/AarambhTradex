/**
 * Confidential Proprietary Strategy Formula & Decision Matrix Service
 * Implements Institutional Mathematical Triggers (Y1-Y6, R1-R6, G1-G6) & Scenarios
 * Matching Institutional Excel Model Specifications Exactly
 */

/**
 * Determine Fibonacci channel band label for a given price
 * Returns "FALSE" if the price is out of bounds (beyond 161.8 level) matching Excel IF formula
 */
export function evaluatePriceBand(price, channels) {
  if (price === null || price === undefined || isNaN(price)) return "FALSE";

  const { risingMain, fallingMain } = channels;

  // Between FC 14.6 and RC 14.6
  if (price >= fallingMain[14.6] && price <= risingMain[14.6]) {
    return "Above FC 14.6 & Below RC 14.6.";
  }

  // Rising bands
  if (price > risingMain[14.6] && price <= risingMain[23.6]) {
    return "Above RC 14.6 & Below RC 23.6.";
  }
  if (price > risingMain[23.6] && price <= risingMain[38.2]) {
    return "Above RC 23.6 & Below RC 38.2.";
  }
  if (price > risingMain[38.2] && price <= risingMain[61.8]) {
    return "Above RC 38.2 & Below RC 61.8.";
  }
  if (price > risingMain[61.8] && price <= risingMain[100]) {
    return "Above RC 61.8 & Below RC 100.";
  }
  if (price > risingMain[100] && price <= risingMain[127.2]) {
    return "Above RC 100 & Below RC 127.2.";
  }
  if (price > risingMain[127.2] && price <= risingMain[161.8]) {
    return "Above RC 127.2 & Below RC 161.8.";
  }

  // Falling bands
  if (price >= fallingMain[23.6] && price < fallingMain[14.6]) {
    return "Above FC 23.6 & Below FC 14.6.";
  }
  if (price >= fallingMain[38.2] && price < fallingMain[23.6]) {
    return "Above FC 38.2 & Below FC 23.6.";
  }
  if (price >= fallingMain[61.8] && price < fallingMain[38.2]) {
    return "Above FC 61.8 & Below FC 38.2.";
  }
  if (price >= fallingMain[100] && price < fallingMain[61.8]) {
    return "Above FC 100 & Below FC 61.8.";
  }
  if (price >= fallingMain[127.2] && price < fallingMain[100]) {
    return "Above FC 127.2 & Below FC 100.";
  }
  if (price >= fallingMain[161.8] && price < fallingMain[127.2]) {
    return "Above FC 161.8 & Below FC 127.2.";
  }

  return "FALSE";
}

/**
 * Determine institutional scenario / pointer type matching Excel rules
 */
export function determineScenario(highCond, lowCond, closeCond) {
  if (!highCond || !lowCond || highCond === "FALSE" || lowCond === "FALSE" || closeCond === "FALSE") {
    return "";
  }

  // 1. UPWARD ROTATION: High in central band (FC 14.6 - RC 14.6), Low in (FC 100 - FC 61.8)
  if (highCond === "Above FC 14.6 & Below RC 14.6." && lowCond === "Above FC 100 & Below FC 61.8.") {
    return "UPWARD ROTATION";
  }

  // 2. TABLE TOP: High in (RC 23.6 - RC 38.2), Low in (FC 100 - FC 61.8)
  if (highCond === "Above RC 23.6 & Below RC 38.2." && lowCond === "Above FC 100 & Below FC 61.8.") {
    return "TABLE TOP";
  }

  // 3. TABLE TENNIS: High in (RC 38.2 - RC 61.8), Low in (FC 61.8 - FC 38.2)
  if (highCond === "Above RC 38.2 & Below RC 61.8." && lowCond === "Above FC 61.8 & Below FC 38.2.") {
    return "TABLE TENNIS";
  }

  // 4. FALLING DUCK: High in (RC 61.8 - RC 100), Low in central band (FC 14.6 - RC 14.6)
  if (highCond === "Above RC 61.8 & Below RC 100." && lowCond === "Above FC 14.6 & Below RC 14.6.") {
    return "FALLING DUCK";
  }

  // 5. RISING JACK: High in (RC 61.8 - RC 100), Low in (FC 23.6 - FC 14.6)
  if (highCond === "Above RC 61.8 & Below RC 100." && lowCond === "Above FC 23.6 & Below FC 14.6.") {
    return "RISING JACK";
  }

  // Extension Breakouts / Breakdowns
  if (highCond.includes("RC 100") || highCond.includes("RC 127") || highCond.includes("RC 161")) {
    return "RISING - FALLING BREAKOUT";
  }
  if (lowCond.includes("FC 100") || lowCond.includes("FC 127") || lowCond.includes("FC 161")) {
    return "FALLING BREAKDOWN";
  }

  return "";
}

/**
 * Calculate full institutional triggers & strategy scenarios from OHLC candle
 * Formula:
 *  - Average: (HIGH + LOW + CLOSE) / 3 (OPEN is strictly NOT considered) across DAILY/WEEKLY/MONTHLY/QUARTERLY/HALF YEARLY/YEARLY/5 YEARLY
 *  - Range: (HIGH - LOW) across all timeframes
 *  - If user modifies average or range, use user's custom values for calculation
 * 
 * @param {Object} ohlc - { open, high, low, close, range, average }
 * @returns {Object} Calculated channels, triggers, and strategy scenarios
 */
export function calculateStrategyData(ohlc = {}) {
  const o = parseFloat(ohlc.open) || 0;
  const h = parseFloat(ohlc.high) || 0;
  const l = parseFloat(ohlc.low) || 0;
  const c = parseFloat(ohlc.close) || 0;

  // Range: (HIGH - LOW) by default, or user-modified custom range if provided
  const range = (ohlc.range !== undefined && ohlc.range !== null && !isNaN(parseFloat(ohlc.range)) && parseFloat(ohlc.range) > 0)
    ? parseFloat(ohlc.range)
    : Math.max(0, h - l);

  // Average: (HIGH + LOW + CLOSE) / 3 (OPEN strictly not considered), or user-modified custom average if provided
  const average = (ohlc.average !== undefined && ohlc.average !== null && !isNaN(parseFloat(ohlc.average)) && parseFloat(ohlc.average) > 0)
    ? parseFloat(ohlc.average)
    : ((h + l + c) / 3);

  const highLow = (h + l) / 2;
  const lowClose = (l + c) / 2;
  const highClose = (h + c) / 2;

  // 1. Rising Channel Computations (Matching Excel Grid Exact Multipliers)
  const risingMain = {
    14.6: c + range * 0.146,
    23.6: c + range * 0.236,
    38.2: c + range * 0.382,
    61.8: c + range * 0.618,
    100: c + range * 1.0,
    127.2: c + range * 1.272,
    161.8: c + range * 1.618,
    261.8: c + range * 2.618,
    423.6: c + range * 4.236,
  };

  const risingUpper = {
    14.6: c + range * 0.1804,
    23.6: risingMain[23.6],
    38.2: c + range * 0.4721,
    61.8: risingMain[61.8] + range * 0.146, // c + range * 0.764
    100: risingMain[100] + range * 0.1039,  // c + range * 1.1039
    127.2: risingMain[127.2] + range * 0.1322, // c + range * 1.4042
    161.8: risingMain[161.8] + range * 0.382,  // c + range * 2.0
    261.8: risingMain[261.8] + range * 0.618,  // c + range * 3.236
    423.6: null,
  };

  const risingLower = {
    14.6: c + range * 0.0345,
    23.6: risingMain[23.6],
    38.2: c + range * 0.3262,
    61.8: risingMain[61.8] - range * 0.0901,
    100: risingMain[100] - range * 0.146,
    127.2: risingMain[127.2] - range * 0.1039,
    161.8: risingMain[161.8] - range * 0.1322,
    261.8: risingMain[261.8] - range * 0.382,
    423.6: null,
  };

  // 2. Falling Channel Computations (Matching Excel Grid Exact Multipliers)
  const fallingMain = {
    14.6: c - range * 0.146,
    23.6: c - range * 0.236,
    38.2: c - range * 0.382,
    61.8: c - range * 0.618,
    100: c - range * 1.0,
    127.2: c - range * 1.272,
    161.8: c - range * 1.618,
    261.8: c - range * 2.618,
    423.6: c - range * 4.236,
  };

  const fallingUpper = {
    14.6: c - range * 0.0345,
    23.6: fallingMain[23.6],
    38.2: c - range * 0.3262,
    61.8: fallingMain[61.8] + range * 0.0901,
    100: fallingMain[100] + range * 0.146,
    127.2: fallingMain[127.2] + range * 0.1039,
    161.8: fallingMain[161.8] + range * 0.1322,
    261.8: fallingMain[261.8] + range * 0.382,
    423.6: null,
  };

  const fallingLower = {
    14.6: c - range * 0.1804,
    23.6: fallingMain[23.6],
    38.2: c - range * 0.4721,
    61.8: fallingMain[61.8] - range * 0.146, // c - range * 0.764
    100: fallingMain[100] - range * 0.1039,  // c - range * 1.1039
    127.2: fallingMain[127.2] - range * 0.1322, // c - range * 1.4042
    161.8: fallingMain[161.8] - range * 0.382,  // c - range * 2.0
    261.8: fallingMain[261.8] - range * 0.618,  // c - range * 3.236
    423.6: null,
  };

  // 3. Mathematical Triggers from Formula Sheet
  // Yellow Triggers: (Close + RC Upper Ratio) / 2
  const Y1 = Number(((c + risingUpper[38.2]) / 2).toFixed(2));
  const Y2 = Number(((c + risingUpper[61.8]) / 2).toFixed(2));
  const Y3 = Number(((c + risingUpper[100]) / 2).toFixed(2));
  const Y4 = Number(((c + risingUpper[127.2]) / 2).toFixed(2));
  const Y5 = Number(((c + risingUpper[161.8]) / 2).toFixed(2));
  const Y6 = Number(((c + risingUpper[261.8]) / 2).toFixed(2));

  // Red Triggers: (Close + FC Lower Ratio) / 2
  const R1 = Number(((c + fallingLower[100]) / 2).toFixed(2));
  const R2 = Number(((c + fallingLower[61.8]) / 2).toFixed(2));
  const R3 = Number(((c + fallingLower[38.2]) / 2).toFixed(2));
  const R4 = Number(((c + fallingLower[127.2]) / 2).toFixed(2));
  const R5 = Number(((c + fallingLower[161.8]) / 2).toFixed(2));
  const R6 = Number(((c + fallingLower[261.8]) / 2).toFixed(2));

  // Green Triggers: (Yx + Rx) / 2
  const G1 = Number(((Y1 + R1) / 2).toFixed(2));
  const G2 = Number(((Y2 + R2) / 2).toFixed(2)); // Equals Close (c)
  const G3 = Number(((Y3 + R3) / 2).toFixed(2));
  const G4 = G2;
  const G5 = G2;
  const G6 = G2;

  const triggers = {
    yellow: { Y1, Y2, Y3, Y4, Y5, Y6 },
    red: { R1, R2, R3, R4, R5, R6 },
    green: { G1, G2, G3, G4, G5, G6 },
    // Formatted array for Part 2 Signal Matrix table matching Excel Image 3 display order
    displayTable: {
      yellow: [Y1, Y2, Y3, Y4, Y5, Y6],
      green: [G1, G2, G3],
      red: [R5, R4, R1, R2, R3, R6], // Excel Order: 880.80 (R5), 883.78 (R4), 885.28 (R1), 886.98 (R2), 888.44 (R3)
    },
  };

  // 4. Conditions & Scenario Evaluation (Dynamic matching Excel Image 3)
  const channelContext = { risingMain, fallingMain };
  const highCond = evaluatePriceBand(h, channelContext);
  const lowCond = evaluatePriceBand(l, channelContext);
  const closeCond = evaluatePriceBand(c, channelContext);
  const highLowCond = evaluatePriceBand(highLow, channelContext);
  const lowCloseCond = evaluatePriceBand(lowClose, channelContext);

  // Scenario determination (Matching Excel formula: if conditions are FALSE, Scenario is empty)
  const scenarioName = determineScenario(highCond, lowCond, closeCond);

  const conditions = {
    high: highCond,
    low: lowCond,
    lowCheck2: "FALSE",
    close: closeCond,
    scenario: scenarioName,
    highLow: highLowCond,
    lowClose: lowCloseCond,
  };

  // 5. Institutional Strategy Scenario Pointer Cards (Exact Match Image 1)
  const scenarios = [
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
  ];

  return {
    ohlc: { open: o, high: h, low: l, close: c, range, average: Number(average.toFixed(2)) },
    calcs: {
      range,
      average: Number(average.toFixed(2)),
      highLow,
      lowClose,
      highClose,
      risingMain,
      risingUpper,
      risingLower,
      fallingMain,
      fallingUpper,
      fallingLower,
    },
    triggers,
    conditions,
    scenarios,
  };
}

export default {
  calculateStrategyData,
};

