import crypto from "crypto";

/**
 * Decodes a Base32 string into a Buffer.
 */
function base32Decode(base32Str) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32Str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = base32chars.indexOf(cleaned.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generates standard RFC 6238 TOTP code (6-digit, 30s step, HMAC-SHA1).
 */
function generateTOTP(secret) {
  if (!secret) throw new Error("TOTP secret is missing");
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, "0");
}

// Global session & quote cache
let cachedSession = null;
let cachedQuotes = null;
let lastQuoteFetchTime = 0;
const QUOTE_CACHE_TTL_MS = 5000; // 5 seconds cache to respect rate limits

// Watchlist instrument definition
export const TICKER_INSTRUMENTS = [
  { exchange: "NSE", token: "99926000", symbol: "NIFTY", label: "NIFTY 50", sub: "Nifty 50 Index", currency: "₹" },
  { exchange: "NSE", token: "99926009", symbol: "BANKNIFTY", label: "BANK NIFTY", sub: "Nifty Bank Index", currency: "₹" },
  { exchange: "BSE", token: "99919000", symbol: "SENSEX", label: "SENSEX", sub: "S&P BSE Sensex", currency: "₹" },
  { exchange: "NSE", token: "99926037", symbol: "FINNIFTY", label: "FIN NIFTY", sub: "Financial Services", currency: "₹" },
  { exchange: "NSE", token: "99926013", symbol: "NIFTYNEXT50", label: "NEXT 50", sub: "Nifty Next 50", currency: "₹" },
  { exchange: "NSE", token: "99926017", symbol: "INDIAVIX", label: "INDIA VIX", sub: "Volatility Index", currency: "" },
  { exchange: "NSE", token: "2885", symbol: "RELIANCE", label: "RELIANCE", sub: "Reliance Industries", currency: "₹" },
  { exchange: "NSE", token: "11536", symbol: "TCS", label: "TCS", sub: "Tata Consultancy Services", currency: "₹" },
  { exchange: "NSE", token: "1333", symbol: "HDFCBANK", label: "HDFC BANK", sub: "HDFC Bank Ltd", currency: "₹" },
  { exchange: "NSE", token: "1594", symbol: "INFY", label: "INFOSYS", sub: "Infosys Limited", currency: "₹" },
  { exchange: "NSE", token: "4963", symbol: "ICICIBANK", label: "ICICI BANK", sub: "ICICI Bank Ltd", currency: "₹" },
  { exchange: "NSE", token: "3045", symbol: "SBIN", label: "SBI", sub: "State Bank of India", currency: "₹" },
  { exchange: "NSE", token: "10604", symbol: "BHARTIARTL", label: "BHARTI AIRTEL", sub: "Bharti Airtel Ltd", currency: "₹" },
  { exchange: "NSE", token: "1660", symbol: "ITC", label: "ITC", sub: "ITC Limited", currency: "₹" },
  { exchange: "NSE", token: "3456", symbol: "TATAMOTORS", label: "TATA MOTORS", sub: "Tata Motors Ltd", currency: "₹" },
  { exchange: "NSE", token: "11483", symbol: "LT", label: "L&T", sub: "Larsen & Toubro Ltd", currency: "₹" },
  { exchange: "MCX", token: "483079", symbol: "GOLD", label: "GOLD", sub: "MCX Gold Futures", currency: "₹" },
  { exchange: "MCX", token: "495214", symbol: "SILVER", label: "SILVER", sub: "MCX Silver Futures", currency: "₹" }
];

/**
 * Authenticates with Angel One SmartAPI and returns a valid session jwtToken.
 */
async function getSmartApiSession(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedSession &&
    cachedSession.jwtToken &&
    cachedSession.expiresAt > now + 60000
  ) {
    return cachedSession;
  }

  const clientCode = process.env.ANGEL_CLIENT_CODE || "P483688";
  const password = process.env.ANGEL_PASSWORD || "1234";
  const apiKey = process.env.ANGEL_API_KEY || "CFARs8Ur";
  const totpSecret = process.env.ANGEL_TOTP_SECRET || "7SRUBYJJRGEXKXK6UWYKZFEYXI";

  const totp = generateTOTP(totpSecret);
  const loginUrl = "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword";

  const res = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "127.0.0.1",
      "X-ClientPublicIP": "106.193.147.98",
      "X-MACAddress": "fe80::216e:6507:4bfe:37ff",
      "X-PrivateKey": apiKey,
    },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      clientcode: clientCode,
      password: password,
      totp: totp,
    }),
  });

  const data = await res.json();
  if (!data.status || !data.data?.jwtToken) {
    throw new Error(`Angel One login failed: ${data.message || "Unknown error"}`);
  }

  cachedSession = {
    jwtToken: data.data.jwtToken,
    feedToken: data.data.feedToken,
    apiKey,
    // Expire cache after 4 hours (SmartAPI tokens last until next morning 5 AM)
    expiresAt: now + 4 * 60 * 60 * 1000,
  };

  return cachedSession;
}

/**
 * Fetches real, live market quotes from Angel One SmartAPI.
 * ONLY live data is returned.
 */
export async function getLiveTickerQuotes() {
  const now = Date.now();
  if (cachedQuotes && now - lastQuoteFetchTime < QUOTE_CACHE_TTL_MS) {
    return cachedQuotes;
  }

  try {
    let session = await getSmartApiSession();

    // Group tokens by exchange
    const exchangeTokens = {};
    for (const inst of TICKER_INSTRUMENTS) {
      if (!exchangeTokens[inst.exchange]) {
        exchangeTokens[inst.exchange] = [];
      }
      exchangeTokens[inst.exchange].push(inst.token);
    }

    const quoteUrl = "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/";

    async function executeQuoteRequest(token) {
      return await fetch(quoteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "127.0.0.1",
          "X-ClientPublicIP": "106.193.147.98",
          "X-MACAddress": "fe80::216e:6507:4bfe:37ff",
          "X-PrivateKey": session.apiKey,
          "Authorization": `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          mode: "FULL",
          exchangeTokens,
        }),
      });
    }

    let res = await executeQuoteRequest(session.jwtToken);

    // If token expired or unauthorized, refresh session and retry once
    if (res.status === 401 || res.status === 403) {
      session = await getSmartApiSession(true);
      res = await executeQuoteRequest(session.jwtToken);
    }

    const json = await res.json();
    if (!json.status && json.errorcode === "AG8001") {
      // Re-authenticate on invalid token code
      session = await getSmartApiSession(true);
      res = await executeQuoteRequest(session.jwtToken);
    }

    const fetchedList = json.data?.fetched || [];

    // Index fetched quotes by exchange + symbolToken
    const quoteMap = new Map();
    for (const q of fetchedList) {
      const key = `${q.exchange}:${q.symbolToken}`;
      quoteMap.set(key, q);
    }

    // Strict live data mapping
    const results = TICKER_INSTRUMENTS.map((inst) => {
      const key = `${inst.exchange}:${inst.token}`;
      const q = quoteMap.get(key);

      if (q && isFinite(parseFloat(q.ltp))) {
        const price = parseFloat(q.ltp);
        const close = parseFloat(q.close);
        let changePct = parseFloat(q.percentChange);
        let netChange = parseFloat(q.netChange);

        if (!isFinite(changePct) && isFinite(close) && close > 0) {
          changePct = ((price - close) / close) * 100;
          netChange = price - close;
        }

        return {
          symbol: inst.symbol,
          label: inst.label,
          sub: inst.sub,
          currency: inst.currency,
          exchange: inst.exchange,
          token: inst.token,
          price,
          close: isFinite(close) ? close : null,
          netChange: isFinite(netChange) ? netChange : 0,
          changePct: isFinite(changePct) ? changePct : 0,
          up: (isFinite(changePct) ? changePct : 0) >= 0,
          unavailable: false,
          isLive: true,
        };
      }

      // Only live data: if not returned, mark unavailable without fabricating numbers
      return {
        symbol: inst.symbol,
        label: inst.label,
        sub: inst.sub,
        currency: inst.currency,
        exchange: inst.exchange,
        token: inst.token,
        price: null,
        changePct: null,
        netChange: null,
        up: true,
        unavailable: true,
        isLive: false,
      };
    });

    cachedQuotes = {
      success: true,
      provider: "AngelOne SmartAPI",
      timestamp: new Date().toISOString(),
      quotes: results,
    };
    lastQuoteFetchTime = now;

    return cachedQuotes;
  } catch (error) {
    console.warn("Angel One live quotes fetch issue (returning cached/fallback):", error.message);
    if (cachedQuotes) {
      return cachedQuotes;
    }
    // Return safe fallback quotes structure
    return {
      success: true,
      provider: "AngelOne SmartAPI (Offline)",
      timestamp: new Date().toISOString(),
      quotes: TICKER_INSTRUMENTS.map((inst) => ({
        symbol: inst.symbol,
        label: inst.label,
        sub: inst.sub,
        currency: inst.currency,
        exchange: inst.exchange,
        token: inst.token,
        price: null,
        changePct: null,
        netChange: null,
        up: true,
        unavailable: true,
        isLive: false,
      })),
    };
  }
}
