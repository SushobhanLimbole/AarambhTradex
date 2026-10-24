/**
 * Symbol Utility Helpers for Frontend Display
 */

/**
 * Mapping for specific Benchmark and Sectoral Index symbols to their human-friendly Index Names
 */
export const INDEX_NAME_MAP = {
  "^NSEI": "Nifty 50",
  "NSEI": "Nifty 50",
  "NIFTY50": "Nifty 50",
  "NIFTY_50": "Nifty 50",

  "^NSEBANK": "Nifty Bank",
  "NSEBANK": "Nifty Bank",
  "NIFTYBANK": "Nifty Bank",
  "NIFTY_BANK": "Nifty Bank",

  "^CNXIT": "Nifty IT",
  "CNXIT": "Nifty IT",
  "NIFTYIT": "Nifty IT",
  "NIFTY_IT": "Nifty IT",

  "^CRSLDX": "Nifty 500",
  "CRSLDX": "Nifty 500",
  "NIFTY500": "Nifty 500",
  "NIFTY_500": "Nifty 500",

  "^NSMIDCP": "Nifty Next 50",
  "NSMIDCP": "Nifty Next 50",
  "NIFTYNEXT50": "Nifty Next 50",
  "NIFTY_NEXT_50": "Nifty Next 50",

  "^CNXPHARMA": "Nifty Pharma",
  "CNXPHARMA": "Nifty Pharma",
  "NIFTYPHARMA": "Nifty Pharma",
  "NIFTY_PHARMA": "Nifty Pharma",

  "^NSEMDCP50": "Nifty Midcap 50",
  "NSEMDCP50": "Nifty Midcap 50",
  "NIFTYMIDCAP50": "Nifty Midcap 50",
  "NIFTY_MIDCAP_50": "Nifty Midcap 50",

  "^BSESN": "S&P BSE SENSEX",
  "BSESN": "S&P BSE SENSEX",
  "SENSEX": "S&P BSE SENSEX",

  "DELTAIN:BTCUSD.P": "BTCUSD (Delta)",
  "DELTAIN:ETHUSD.P": "ETHUSD (Delta)",
  "DELTAIN:XRPUSD.P": "XRPUSD (Delta)",
  "DELTAIN:SOLUSD.P": "SOLUSD (Delta)",
  "DELTAIN:XAUTUSD.P": "XAUTUSD (Delta)",
  "DELTAIN:PAXGUSD.P": "PAXGUSD (Delta)",
  "DELTAIN:SLVONUSD.P": "SLVONUSD (Delta)",
  "OANDA:XAUUSD": "XAUUSD (OANDA)",
  "OANDA:XAGUSD": "XAGUSD (OANDA)",
};

/**
 * Strips exchange suffixes (.NS, .BO, .NSE, .BSE, etc.), index prefixes (^),
 * and global asset suffixes (-USD, -USDT for Crypto, =X for Metals) for clean frontend UI display.
 * For specific benchmark indices (e.g. ^NSEI, ^NSEBANK, ^CNXIT, ^CRSLDX, etc.), returns their official Index Name.
 *
 * @param {string} symbol - e.g. 'RELIANCE.NS', 'TCS.BO', '^NSEI', '^NSEBANK', 'BTC-USD', 'XAUUSD=X'
 * @returns {string} Clean symbol name e.g. 'RELIANCE', 'TCS', 'Nifty 50', 'Nifty Bank', 'BTC', 'XAUUSD'
 */
export const stripSymbolSuffix = (symbol) => {
  if (!symbol || typeof symbol !== "string") {
    if (typeof symbol === "number") return String(symbol);
    return "";
  }
  const raw = String(symbol).trim();
  const upper = raw.toUpperCase();

  // 1. Check if it's one of the specific index symbols
  if (INDEX_NAME_MAP[upper]) {
    return INDEX_NAME_MAP[upper];
  }

  let s = raw;
  // Strip leading ^ prefix (e.g. ^NSEI -> NSEI, ^BSESN -> BSESN)
  s = s.replace(/^\^/, "");
  // Strip leading DELTAIN: or OANDA: prefix
  s = s.replace(/^(DELTAIN|OANDA):/i, "");
  // Strip dot suffixes like .NS, .BO, .NSE, .BSE, .IN, etc. (case-insensitive)
  s = s.replace(/\.(NS|BO|NSE|BSE|IN|IS|ns|bo|nse|bse)$/i, "");
  // Strip global assets metals suffix =X (e.g. XAUUSD=X -> XAUUSD, XAGUSD=X -> XAGUSD)
  s = s.replace(/=X$/i, "");
  // Strip global assets crypto currency suffix like -USD, -USDT, -INR (e.g. BTC-USD -> BTC, ETH-USD -> ETH, SOL-USD -> SOL, XRP-USD -> XRP)
  s = s.replace(/-(USD|USDT|INR|EUR|GBP|usd|usdt|inr|eur|gbp)$/i, "");
  // Also strip any hyphen exchange tags like -EQ, -BE
  s = s.replace(/-(EQ|BE|eq|be)$/i, "");

  // Check again after stripping suffixes
  if (INDEX_NAME_MAP[s.toUpperCase()]) {
    return INDEX_NAME_MAP[s.toUpperCase()];
  }

  return s;
};

export default stripSymbolSuffix;
