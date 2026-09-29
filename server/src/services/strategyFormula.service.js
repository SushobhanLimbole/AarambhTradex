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
 * Strictly maps to: Table Tennis, Table Top, Upward Rotation, Rising Jack, Falling Duck
 * If no match, returns "FALSE"
 */
export function determineScenario(h, l, channels, highCond, lowCond, c) {
  const hVal = parseFloat(h) || 0;
  const lVal = parseFloat(l) || 0;
  let cVal = parseFloat(c);

  // If close is available, adjust close by -0.05 if high==close or +0.05 if low==close
  if (!isNaN(cVal)) {
    let adjC = cVal;
    if (Math.abs(hVal - cVal) < 0.0001) {
      adjC = cVal - 0.05;
    } else if (Math.abs(lVal - cVal) < 0.0001) {
      adjC = cVal + 0.05;
    }

    const evalP = (highP, lowP, closeP) => {
      const r = Math.max(0, highP - lowP);
      const rm14 = closeP + r * 0.146;
      const rm38 = closeP + r * 0.382;
      const rm61 = closeP + r * 0.618;
      const rm100 = closeP + r * 1.0;
      const fm14 = closeP - r * 0.146;
      const fm38 = closeP - r * 0.382;
      const fm61 = closeP - r * 0.618;
      const fm100 = closeP - r * 1.0;

      if (highP > rm61 && highP < rm100 && lowP < fm14 && lowP > fm38) return "Rising Jack";
      if (highP > rm38 && highP < rm61 && lowP < fm38 && lowP > fm61) return "Table Tennis";
      if (highP > rm14 && highP < rm38 && lowP < fm61 && lowP > fm100) return "Table Top";
      if (highP > fm14 && highP < rm14 && lowP > fm100 && lowP < fm61) return "Upward Rotation";
      if (highP > rm61 && highP < rm100 && lowP > fm14 && lowP < rm14) return "Falling Duck";
      return "FALSE";
    };

    let res = evalP(hVal, lVal, adjC);
    if (res !== "FALSE") return res;
  }

  // Fallback if channels provided
  if (channels && channels.risingMain && channels.fallingMain && typeof h === "number" && typeof l === "number") {
    const rm = channels.risingMain;
    const fm = channels.fallingMain;

    const evalP = (highVal, lowVal) => {
      if (highVal > rm[61.8] && highVal < rm[100] && lowVal < fm[14.6] && lowVal > fm[38.2]) return "Rising Jack";
      if (highVal > rm[38.2] && highVal < rm[61.8] && lowVal < fm[38.2] && lowVal > fm[61.8]) return "Table Tennis";
      if (highVal > rm[14.6] && highVal < rm[38.2] && lowVal < fm[61.8] && lowVal > fm[100]) return "Table Top";
      if (highVal > fm[14.6] && highVal < rm[14.6] && lowVal > fm[100] && lowVal < fm[61.8]) return "Upward Rotation";
      if (highVal > rm[61.8] && highVal < rm[100] && lowVal > fm[14.6] && lowVal < rm[14.6]) return "Falling Duck";
      return "FALSE";
    };

    let res = evalP(hVal, lVal);
    return res;
  }

  // Fallback if called with condition string arguments
  const hC = typeof h === "string" ? h : highCond;
  const lC = typeof l === "string" ? l : lowCond;
  if (!hC || !lC || hC === "FALSE" || lC === "FALSE") return "FALSE";

  if (hC === "Above FC 14.6 & Below RC 14.6." && lC === "Above FC 100 & Below FC 61.8.") return "Upward Rotation";
  if ((hC === "Above RC 14.6 & Below RC 23.6." || hC === "Above RC 23.6 & Below RC 38.2.") && lC === "Above FC 100 & Below FC 61.8.") return "Table Top";
  if (hC === "Above RC 38.2 & Below RC 61.8." && lC === "Above FC 61.8 & Below FC 38.2.") return "Table Tennis";
  if (hC === "Above RC 61.8 & Below RC 100." && (lC === "Above FC 23.6 & Below FC 14.6." || lC === "Above FC 38.2 & Below FC 23.6.")) return "Rising Jack";
  if (hC === "Above RC 61.8 & Below RC 100." && lC === "Above FC 14.6 & Below RC 14.6.") return "Falling Duck";

  return "FALSE";
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
  const scenarioName = determineScenario(h, l, channelContext, highCond, lowCond);

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

