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

  const flatTriggers = {
    ...triggers.yellow,
    ...triggers.red,
    ...triggers.green,
  };

  // Pattern-based scenario defaults if specialized triggers mapped
  const normalizedPattern = String(pattern).trim().toUpperCase();

  switch (normalizedPattern) {
    case "TABLE TENNIS":
      // Table tennis revolves around Y2 / R2 / G2 channel
      break;
    case "BUYING POINTER":
    case "RISING JACK":
      // Buying pointer aligns around Y3 / R3 / G3
      break;
    case "SELLING POINTER":
    case "FALLING DUCK":
      // Selling pointer aligns around Y1 / R1 / G1
      break;
    case "TABLE TOP":
    case "RISING - FALLING BREAKOUT":
      // Table top revolves around Y4 / R4 / G2 extensions
      break;
    case "UPWARD ROTATION":
      // Upward rotation focuses on Y1-Y3 rotation
      break;
    default:
      break;
  }

  const triggerVal = flatTriggers[triggerType];
  return triggerVal !== undefined ? Number(triggerVal) : null;
}

export default calculateTrigger;
