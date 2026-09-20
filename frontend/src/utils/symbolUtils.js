/**
 * Symbol Utility Helpers for Frontend Display
 */

/**
 * Strips exchange suffixes (.NS, .BO, .NSE, .BSE, etc.), index prefixes (^),
 * and global asset suffixes (-USD, -USDT for Crypto, =X for Metals) for clean frontend UI display
 * @param {string} symbol - e.g. 'RELIANCE.NS', 'TCS.BO', '^NSEI', 'BTC-USD', 'XAUUSD=X'
 * @returns {string} Clean symbol name e.g. 'RELIANCE', 'TCS', 'NSEI', 'BTC', 'XAUUSD'
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
  // Strip global assets metals suffix =X (e.g. XAUUSD=X -> XAUUSD, XAGUSD=X -> XAGUSD)
  s = s.replace(/=X$/i, "");
  // Strip global assets crypto currency suffix like -USD, -USDT, -INR (e.g. BTC-USD -> BTC, ETH-USD -> ETH, SOL-USD -> SOL, XRP-USD -> XRP)
  s = s.replace(/-(USD|USDT|INR|EUR|GBP|usd|usdt|inr|eur|gbp)$/i, "");
  // Also strip any hyphen exchange tags like -EQ, -BE
  s = s.replace(/-(EQ|BE|eq|be)$/i, "");
  return s;
};

export default stripSymbolSuffix;
