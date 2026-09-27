import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedHolidays = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Forces reloading of holiday data from file
 */
export function reloadHolidayCache() {
  cachedHolidays = null;
  lastCacheTime = 0;
  return getHolidayData();
}

/**
 * Loads holiday definitions from holidays.json with in-memory caching
 */
export function getHolidayData(forceReload = false) {
  const now = Date.now();
  if (!forceReload && cachedHolidays && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedHolidays;
  }

  const jsonPaths = [
    path.resolve(__dirname, "../data/holidays.json"),
    path.resolve(__dirname, "../scripts/holidays.json"),
  ];

  for (const jsonPath of jsonPaths) {
    if (fs.existsSync(jsonPath)) {
      try {
        const fileContent = fs.readFileSync(jsonPath, "utf8");
        const parsed = JSON.parse(fileContent);
        if (parsed) {
          cachedHolidays = parsed;
          lastCacheTime = now;
          return cachedHolidays;
        }
      } catch (err) {
        console.warn(`[HolidayUtils] Warning: Failed to parse ${jsonPath}:`, err.message);
      }
    }
  }

  // Fallback if file doesn't exist yet
  return {
    equityHolidayDates: [],
    NSE: { equities: [] },
    BSE: { equities: [] },
    GLOBAL_METALS: { fullClosureDates: [] },
  };
}

/**
 * Checks if a given date (YYYY-MM-DD or Date) is an Indian Market (NSE/BSE) holiday or weekend.
 * @param {string|Date} dateInput
 * @returns {{ isHoliday: boolean, isWeekend: boolean, reason?: string, dateStr: string }}
 */
export function isIndianMarketHoliday(dateInput) {
  let dateStr = "";
  let dateObj = null;

  if (!dateInput) {
    // Default to current date in IST timezone
    dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const [y, m, d] = dateStr.split("-").map(Number);
    dateObj = new Date(Date.UTC(y, m - 1, d));
  } else if (typeof dateInput === "string") {
    dateStr = dateInput.slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    dateObj = new Date(Date.UTC(y, m - 1, d));
  } else if (dateInput instanceof Date) {
    dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(dateInput);
    const [y, m, d] = dateStr.split("-").map(Number);
    dateObj = new Date(Date.UTC(y, m - 1, d));
  }

  const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0) {
    return { isHoliday: true, isWeekend: true, reason: "Sunday (Weekend Closure)", dateStr };
  }
  if (dayOfWeek === 6) {
    return { isHoliday: true, isWeekend: true, reason: "Saturday (Weekend Closure)", dateStr };
  }

  const data = getHolidayData();
  const nseEquities = data?.NSE?.equities || [];
  const matchedHoliday = nseEquities.find((h) => h.date === dateStr);

  if (matchedHoliday) {
    return {
      isHoliday: true,
      isWeekend: false,
      reason: `NSE/BSE Holiday: ${matchedHoliday.description || "Official Trading Holiday"}`,
      dateStr,
    };
  }

  return { isHoliday: false, isWeekend: false, dateStr };
}

/**
 * Checks if a given date is a full market closure for Precious Metals (XAUUSD=X, XAGUSD=X)
 * @param {string|Date} dateInput
 * @returns {{ isHoliday: boolean, reason?: string, dateStr: string }}
 */
export function isMetalsMarketHoliday(dateInput) {
  let dateStr = "";
  if (!dateInput) {
    dateStr = new Date().toISOString().slice(0, 10);
  } else if (typeof dateInput === "string") {
    dateStr = dateInput.slice(0, 10);
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().slice(0, 10);
  }

  const data = getHolidayData();
  const metalsHolidays = data?.GLOBAL_METALS?.holidays || [];
  const matched = metalsHolidays.find((h) => h.date === dateStr && h.status === "Full Market Closure");

  if (matched) {
    return {
      isHoliday: true,
      reason: `Metals Full Closure: ${matched.holiday}`,
      dateStr,
    };
  }

  return { isHoliday: false, dateStr };
}

/**
 * Detects whether a candle is a forward-fill / unopened phantom candle.
 *
 * Filter criteria:
 * 1. Flat price: Open === High === Low === Close
 * 2. Zero activity: Volume === 0 OR Volume is null/undefined/NaN/<=0
 *
 * Checking both conditions simultaneously prevents filtering out valid circuit trades
 * (which have Volume > 0) while cleanly discarding phantom candles.
 *
 * @param {Object} candle - OHLCV object
 * @returns {boolean} - Returns true if the candle is a phantom/unopened record and should be discarded.
 */
export function isPhantomOrUnopenedCandle(candle) {
  if (!candle) return true;

  const { open, high, low, close, volume } = candle;

  // 1. Validate numerical presence
  if (open == null || high == null || low == null || close == null) {
    return true;
  }

  const o = Number(open);
  const h = Number(high);
  const l = Number(low);
  const c = Number(close);

  if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) {
    return true;
  }

  // Reject zero/negative price anomalies
  if (o <= 0 || h <= 0 || l <= 0 || c <= 0) {
    return true;
  }

  // 2. Condition 1: Flat price across all 4 OHLC points
  const isFlatPrice = (o === h && h === l && l === c);

  // 3. Condition 2: Zero activity (Volume === 0 or missing/NaN)
  const volNum = Number(volume);
  const isZeroActivity = (
    volume === null ||
    volume === undefined ||
    isNaN(volNum) ||
    volNum <= 0
  );

  // Discard only when BOTH conditions are met simultaneously
  if (isFlatPrice && isZeroActivity) {
    return true;
  }

  return false;
}
