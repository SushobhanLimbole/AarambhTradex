/**
 * Symbol Utility Helpers for Frontend Display
 */

/**
 * Strips exchange suffixes (.NS, .BO, .NSE, .BSE, etc.) and index prefixes (^) for clean frontend UI display
 * @param {string} symbol - e.g. 'RELIANCE.NS', 'TCS.BO', '^NSEI'
 * @returns {string} Clean symbol name e.g. 'RELIANCE', 'TCS', 'NSEI'
 */
export const stripSymbolSuffix = (symbol) => {
  if (!symbol || typeof symbol !== "string") {
    if (typeof symbol === "number") return String(symbol);
    return "";
  }
  let s = String(symbol).trim();
  // Strip leading ^ prefix (e.g. ^NSEI -> NSEI, ^BSESN -> BSESN)
  s = s.replace(/^\^/, "");
  // Strip dot suffixes like .NS, .BO, .NSE, .BSE, .IN, etc. (case-insensitive)
  s = s.replace(/\.(NS|BO|NSE|BSE|IN|IS|ns|bo|nse|bse)$/i, "");
  // Also strip any hyphen exchange tags like -EQ, -BE
  s = s.replace(/-(EQ|BE|eq|be)$/i, "");
  return s;
};

export default stripSymbolSuffix;
