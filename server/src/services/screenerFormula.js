import { calculateStrategyData } from "./strategyFormula.service.js";

/**
 * Modular Mathematical Formulas for Breakout Screener (Y, G, R levels)
 * Based on Institutional Mathematical Trigger Formula Sheet & Scenarios
 * 
 * @param {Object} cmp2Candle - Aggregated OHLCV candle for CMP2 reference period:
 *                               { open, high, low, close, volume }
 * @param {string} pattern    - 'TABLE TOP' | 'UPWARD ROTATION' | 'TABLE TENNIS' | 'RISING JACK' | 'FALLING DUCK' | 'BUYING POINTER' | 'SELLING POINTER' | 'RISING - FALLING BREAKOUT'
 * @param {string} triggerType - Trigger level code:
 *                               Yellow: 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'
 *                               Red:    'R1', 'R2', 'R3', 'R4', 'R5', 'R6'
 *                               Green:  'G1', 'G2', 'G3', 'G4', 'G5', 'G6'
 * @returns {number|null} Calculated trigger price level
 */
export function calculateTrigger(cmp2Candle, pattern = "TABLE TOP", triggerType = "Y1") {
  if (!cmp2Candle) return null;

  const { triggers } = calculateStrategyData(cmp2Candle);
  if (!triggers) return null;

  const flatTriggers = {
    ...triggers.yellow,
    ...triggers.red,
    ...triggers.green,
  };

  const triggerVal = flatTriggers[triggerType];
  return triggerVal !== undefined ? Number(triggerVal) : null;
}

/**
 * Evaluates whether a stock qualifies for a given trigger condition
 * - Y group (Y1..Y6): Stocks qualify if CMP1 Close > Y trigger level (greater than Y)
 * - R group (R1..R6): Stocks qualify if CMP1 Close < R trigger level (less than R)
 * - G group (G1..G6): Stocks qualify if CMP1 Close is between corresponding Y and R group thresholds (R <= CMP1 Close <= Y)
 *
 * @param {Object} cmp1Candle - { close, ... }
 * @param {Object} cmp2Candle - Reference period candle
 * @param {string} pattern - Pattern filter
 * @param {string} triggerType - 'Y1'..'Y6', 'R1'..'R6', 'G1'..'G6'
 * @returns {Object|null} - { trigger, triggerPrice, pctBreakout, lowerPrice, upperPrice, group } or null if not qualified
 */
export function evaluateScreenerTrigger(cmp1Candle, cmp2Candle, pattern, triggerType) {
  if (!cmp1Candle || !cmp2Candle || !triggerType) return null;

  const cmp1Close = parseFloat(cmp1Candle.close);
  if (isNaN(cmp1Close)) return null;

  const { triggers } = calculateStrategyData(cmp2Candle);
  if (!triggers) return null;

  const trig = String(triggerType).trim().toUpperCase();
  const levelNum = trig.replace(/\D/g, "") || "1";
  const group = trig.charAt(0); // 'Y', 'R', or 'G'

  const yPrice = triggers.yellow ? triggers.yellow[`Y${levelNum}`] : null;
  const rPrice = triggers.red ? triggers.red[`R${levelNum}`] : null;
  const gPrice = triggers.green ? triggers.green[`G${levelNum}`] : null;

  if (group === "Y") {
    const triggerPrice = yPrice !== undefined && yPrice !== null ? Number(yPrice) : null;
    if (triggerPrice === null) return null;
    if (cmp1Close > triggerPrice) {
      const pctBreakout = Number((((cmp1Close - triggerPrice) / triggerPrice) * 100).toFixed(2));
      return {
        trigger: trig,
        group: "Y",
        triggerPrice,
        pctBreakout,
      };
    }
  } else if (group === "R") {
    const triggerPrice = rPrice !== undefined && rPrice !== null ? Number(rPrice) : null;
    if (triggerPrice === null) return null;
    if (cmp1Close < triggerPrice) {
      const pctBreakout = Number((((cmp1Close - triggerPrice) / triggerPrice) * 100).toFixed(2));
      return {
        trigger: trig,
        group: "R",
        triggerPrice,
        pctBreakout,
      };
    }
  } else if (group === "G") {
    // For G: Between Y and R group thresholds (e.g. min(Yx, Rx) <= CMP1 Close <= max(Yx, Rx))
    if (yPrice === null || yPrice === undefined || rPrice === null || rPrice === undefined) return null;
    const lowerBound = Math.min(Number(yPrice), Number(rPrice));
    const upperBound = Math.max(Number(yPrice), Number(rPrice));
    const centerPrice = gPrice !== undefined && gPrice !== null
      ? Number(gPrice)
      : Number(((lowerBound + upperBound) / 2).toFixed(2));

    if (cmp1Close >= lowerBound && cmp1Close <= upperBound) {
      const pctBreakout = Number((((cmp1Close - centerPrice) / centerPrice) * 100).toFixed(2));
      return {
        trigger: trig,
        group: "G",
        triggerPrice: centerPrice,
        lowerPrice: lowerBound,
        upperPrice: upperBound,
        pctBreakout,
      };
    }
  } else {
    // Fallback for any other custom trigger key
    const flatTriggers = {
      ...triggers.yellow,
      ...triggers.red,
      ...triggers.green,
    };
    const triggerPrice = flatTriggers[trig] !== undefined ? Number(flatTriggers[trig]) : null;
    if (triggerPrice !== null && cmp1Close > triggerPrice) {
      const pctBreakout = Number((((cmp1Close - triggerPrice) / triggerPrice) * 100).toFixed(2));
      return {
        trigger: trig,
        group: "Y",
        triggerPrice,
        pctBreakout,
      };
    }
  }

  return null;
}

export default calculateTrigger;
