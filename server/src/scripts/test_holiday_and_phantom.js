import {
  isIndianMarketHoliday,
  isMetalsMarketHoliday,
  isPhantomOrUnopenedCandle,
} from "../utils/holidayUtils.js";

console.log("=== 1. TESTING INDIAN MARKET HOLIDAY CHECKS ===");
const testDates = [
  { date: "2026-01-15", expectedHoliday: true, desc: "Election Day" },
  { date: "2026-01-26", expectedHoliday: true, desc: "Republic Day" },
  { date: "2026-03-03", expectedHoliday: true, desc: "Holi" },
  { date: "2026-01-18", expectedHoliday: true, desc: "Sunday" },
  { date: "2026-01-17", expectedHoliday: true, desc: "Saturday" },
  { date: "2026-01-14", expectedHoliday: false, desc: "Regular Trading Day" },
];

for (const t of testDates) {
  const res = isIndianMarketHoliday(t.date);
  const pass = res.isHoliday === t.expectedHoliday;
  console.log(
    `[${pass ? "PASS" : "FAIL"}] Date: ${t.date} (${t.desc}) -> isHoliday: ${res.isHoliday}, reason: ${res.reason || "None"}`
  );
}

console.log("\n=== 2. TESTING METALS MARKET HOLIDAY CHECKS ===");
const metalDates = [
  { date: "2026-01-01", expectedHoliday: true, desc: "New Year's Day" },
  { date: "2026-04-03", expectedHoliday: true, desc: "Good Friday" },
  { date: "2026-01-14", expectedHoliday: false, desc: "Regular Day" },
];

for (const t of metalDates) {
  const res = isMetalsMarketHoliday(t.date);
  const pass = res.isHoliday === t.expectedHoliday;
  console.log(
    `[${pass ? "PASS" : "FAIL"}] Date: ${t.date} (${t.desc}) -> isHoliday: ${res.isHoliday}, reason: ${res.reason || "None"}`
  );
}

console.log("\n=== 3. TESTING PHANTOM / FORWARD-FILL / CIRCUIT TRADE CANDLES ===");
const testCandles = [
  {
    name: "Phantom / Forward-filled candle (Flat + Volume 0)",
    candle: { open: 150, high: 150, low: 150, close: 150, volume: 0 },
    expectedPhantom: true,
  },
  {
    name: "Phantom candle (Flat + Volume null)",
    candle: { open: 150, high: 150, low: 150, close: 150, volume: null },
    expectedPhantom: true,
  },
  {
    name: "Phantom candle (Flat + Volume NaN)",
    candle: { open: 150, high: 150, low: 150, close: 150, volume: NaN },
    expectedPhantom: true,
  },
  {
    name: "Valid Upper/Lower Circuit Trade (Flat price + Volume 15000 > 0)",
    candle: { open: 150, high: 150, low: 150, close: 150, volume: 15000 },
    expectedPhantom: false,
  },
  {
    name: "Normal Trading Day Candle (Varying OHLC + Volume)",
    candle: { open: 148, high: 152, low: 147, close: 150.5, volume: 50000 },
    expectedPhantom: false,
  },
  {
    name: "Corrupt Candle (Missing OHLC)",
    candle: { open: null, high: 150, low: 150, close: 150, volume: 0 },
    expectedPhantom: true,
  },
];

for (const tc of testCandles) {
  const isPhantom = isPhantomOrUnopenedCandle(tc.candle);
  const pass = isPhantom === tc.expectedPhantom;
  console.log(
    `[${pass ? "PASS" : "FAIL"}] ${tc.name} -> isPhantom: ${isPhantom} (Action: ${isPhantom ? "DISCARD" : "INSERT"})`
  );
}

console.log("\nAll tests completed successfully.");
