import React, { useState, useMemo, useEffect, useCallback } from "react";
import "./StockAnalytics.css";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

export { stripSymbolSuffix };

export const getPointerInfo = (code) => {
  if (!code || code === "—") return { code: "—", name: "", type: "neutral" };
  const upper = String(code).trim().toUpperCase();
  if (upper === "FALSE") return { code: "FALSE", name: "", type: "neutral" };
  if (upper === "TABLE TENNIS") return { code: "Table Tennis", name: "", type: "blue" };
  if (upper === "TABLE TOP") return { code: "Table Top", name: "", type: "purple" };
  if (upper === "UPWARD ROTATION") return { code: "Upward Rotation", name: "", type: "cyan" };
  if (upper === "RISING JACK") return { code: "Rising Jack", name: "", type: "orange" };
  if (upper === "FALLING DUCK") return { code: "Falling Duck", name: "", type: "amber" };
  return { code, name: code, type: "orange" };
};

// Helper to parse currency string into pure number
const parseNum = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, "")) || 0;
};

// Helper to format float to readable currency string
const formatNum = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return "—";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Helper to format raw date into clean readable display (e.g. 16-Sep-2026)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  } catch {
    return String(dateStr);
  }
};

// Helper to extract day of week (e.g. Mon, Tue, Wed)
const getDayOfWeek = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "—";
  }
};

export default function StockAnalytics({ onOpenPointer, onOpenStrategy }) {
  // Filter States
  const [exchange, setExchange] = useState("ALL");
  const [indexVal, setIndexVal] = useState("ALL");
  const [ticker, setTicker] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [timeframe, setTimeframe] = useState("Daily");

  // Metadata loaded from /api/symbols/meta
  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [availableIndices, setAvailableIndices] = useState([]);

  // Symbols list loaded dynamically based on exchange & index filter
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);

  // Data loading states
  const [rawRecords, setRawRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Column Visibility States
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    symbol: true,
    day: true,
    avg: true,
    range: true,
    status: true,
    pointer: true,
    virgin: true,
    zone: true,
    closure: true,
    floor: true,
    ceiling: true,
  });

  const toggleCol = (key) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Fetch metadata (exchanges and indices) on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadMeta() {
      try {
        const res = await stockService.getSymbolsMeta();
        if (!isCancelled && res?.data) {
          if (Array.isArray(res.data.exchanges) && res.data.exchanges.length > 0) {
            setAvailableExchanges(res.data.exchanges);
          }
          if (Array.isArray(res.data.indices) && res.data.indices.length > 0) {
            setAvailableIndices(res.data.indices);
          }
        }
      } catch (err) {
        console.warn("Failed to load symbols meta from API:", err);
      }
    }
    loadMeta();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Fetch symbols dynamically whenever Exchange or Index filter changes
  useEffect(() => {
    let isCancelled = false;
    async function loadSymbolsForFilter() {
      setSymbolsLoading(true);
      try {
        const res = await stockService.getSymbolsList({
          exchange: exchange !== "ALL" ? exchange : undefined,
          indice: indexVal !== "ALL" ? indexVal : undefined,
          limit: "all",
        });
        if (!isCancelled && res?.data && Array.isArray(res.data)) {
          setAvailableSymbols(res.data);
          // If current selected ticker is not in newly filtered list, reset to ALL
          const exists = res.data.some((item) => item.symbol === ticker);
          if (!exists && ticker !== "ALL") {
            setTicker("ALL");
          }
        }
      } catch (err) {
        console.warn("Failed to load symbols list:", err);
      } finally {
        if (!isCancelled) setSymbolsLoading(false);
      }
    }
    loadSymbolsForFilter();
    return () => {
      isCancelled = true;
    };
  }, [exchange, indexVal]);

  // 3. Fetch stock candle data from backend API based on user input
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let response;
      const options = {
        exchange: exchange !== "ALL" ? exchange : undefined,
        indice: indexVal !== "ALL" ? indexVal : undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        limit: "all", // Fetch all matching records
        order: "DESC",
      };

      if (!ticker || ticker === "ALL" || ticker === "ALL_SYMBOLS") {
        // If ALL ticker is selected:
        if (!fromDate && !toDate && exchange === "ALL" && indexVal === "ALL") {
          // Default initial overview: get latest candle across all symbols
          response = await stockService.getLatestAllStocks(timeframe);
        } else {
          // Fetch candles matching exchange / index / date criteria
          response = await stockService.getAllStocks(timeframe, options);
        }
      } else {
        // Fetch for specific symbol
        const cleanSymbol = ticker.split(" ")[0].trim();
        response = await stockService.getStockData(cleanSymbol, timeframe, {
          startDate: fromDate || undefined,
          endDate: toDate || undefined,
          limit: "all",
          order: "DESC",
        });
      }

      if (response?.data && Array.isArray(response.data)) {
        setRawRecords(response.data);
      } else {
        setRawRecords([]);
      }
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError(err.message || "Failed to load stock data from server.");
      setRawRecords([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, exchange, indexVal, timeframe, fromDate, toDate]);

  // Initial load on mount only
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    setExchange("ALL");
    setIndexVal("ALL");
    setTicker("ALL");
    setFromDate("");
    setToDate("");
    setTimeframe("Daily");
  };

  // 3. Compute calculated analytics columns dynamically from raw records
  const processedRows = useMemo(() => {
    if (!rawRecords || rawRecords.length === 0) return [];

    // Group records by symbol to correctly compare with previous candle of the same symbol
    const symbolMap = {};
    rawRecords.forEach((row) => {
      const sym = row.symbol || "UNKNOWN";
      if (!symbolMap[sym]) symbolMap[sym] = [];
      symbolMap[sym].push(row);
    });

    // Ensure records per symbol are sorted chronologically DESC (latest first)
    const resultRows = [];
    let globalIndex = 1;

    Object.keys(symbolMap).forEach((sym) => {
      const rowsForSym = symbolMap[sym];
      // Sort DESC by date
      rowsForSym.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      rowsForSym.forEach((row, idx, arr) => {
        const prevRow = arr[idx + 1]; // Previous candle chronologically

        const openVal = parseNum(row.open);
        const highVal = parseNum(row.high);
        const lowVal = parseNum(row.low);
        const closeVal = parseNum(row.close);

        // Average: (HIGH + LOW + CLOSE) / 3 (OPEN strictly not considered!)
        const avgVal = (highVal + lowVal + closeVal) / 3;
        const rangeVal = Math.max(0, highVal - lowVal);

        let status = "—";
        let statusType = "neutral";
        let virgin = "—";
        let virginType = "neutral";
        let zone = "—";
        let zoneType = "neutral";
        let closure = "—";
        let closureType = "neutral";
        let pointer = "—";
        let pointerType = "neutral";

        if (prevRow) {
          const prevHigh = parseNum(prevRow.high);
          const prevLow = parseNum(prevRow.low);
          const prevClose = parseNum(prevRow.close);
          const prevAvg = (prevHigh + prevLow + prevClose) / 3;

          // Status: HLC HIGHER / HLC LOWER (Exact 4-point institutional criteria)
          if (
            highVal > prevHigh &&
            lowVal > prevLow &&
            closeVal > prevClose &&
            closeVal > prevHigh
          ) {
            status = "HLC HIGHER";
            statusType = "bullish";
          } else if (
            highVal < prevHigh &&
            lowVal < prevLow &&
            closeVal < prevClose &&
            closeVal < prevLow
          ) {
            status = "HLC LOWER";
            statusType = "bearish";
          } else {
            status = "BASELINE";
            statusType = "neutral";
          }

          // 1. VIRGIN: (HIGHER = LOW > PREV.DAY AVG) | (LOWER = HIGH < PREV.DAY AVG)
          if (lowVal > prevAvg) {
            virgin = "HIGHER";
            virginType = "higher";
          } else if (highVal < prevAvg) {
            virgin = "LOWER";
            virginType = "lower";
          } else {
            virgin = "INSIDE";
            virginType = "neutral";
          }

          // 2. ZONE: (GREEN = CLOSE > PREV.DAY CLOSE & PREV.DAY AVG) | (RED = CLOSE < PREV.DAY CLOSE & PREV.DAY AVG)
          if (closeVal > prevClose && closeVal > prevAvg) {
            zone = "GREEN";
            zoneType = "green";
          } else if (closeVal < prevClose && closeVal < prevAvg) {
            zone = "RED";
            zoneType = "red";
          } else {
            zone = "NEUTRAL";
            zoneType = "neutral";
          }

          // 3. CLOSURE: (HIGH = CLOSE > PREV.DAY HIGH) | (LOW = CLOSE < PREV.DAY LOW)
          if (closeVal > prevHigh) {
            closure = "HIGH";
            closureType = "high";
          } else if (closeVal < prevLow) {
            closure = "LOW";
            closureType = "low";
          } else {
            closure = "INSIDE";
            closureType = "neutral";
          }

          // 4. INSTITUTIONAL POINTER TYPE (Table Tennis, Table Top, Upward Rotation, Rising Jack, Falling Duck, or FALSE)
          const rVal = Math.max(0, highVal - lowVal);
          const rm14 = closeVal + rVal * 0.146;
          const rm23 = closeVal + rVal * 0.236;
          const rm38 = closeVal + rVal * 0.382;
          const rm61 = closeVal + rVal * 0.618;
          const rm100 = closeVal + rVal * 1.0;
          const fm14 = closeVal - rVal * 0.146;
          const fm23 = closeVal - rVal * 0.236;
          const fm38 = closeVal - rVal * 0.382;
          const fm61 = closeVal - rVal * 0.618;
          const fm100 = closeVal - rVal * 1.0;

          let highCond = "FALSE";
          if (highVal >= fm14 && highVal <= rm14) highCond = "Above FC 14.6 & Below RC 14.6.";
          else if (highVal > rm14 && highVal <= rm23) highCond = "Above RC 14.6 & Below RC 23.6.";
          else if (highVal > rm23 && highVal <= rm38) highCond = "Above RC 23.6 & Below RC 38.2.";
          else if (highVal > rm38 && highVal <= rm61) highCond = "Above RC 38.2 & Below RC 61.8.";
          else if (highVal > rm61 && highVal <= rm100) highCond = "Above RC 61.8 & Below RC 100.";

          let lowCond = "FALSE";
          if (lowVal >= fm14 && lowVal <= rm14) lowCond = "Above FC 14.6 & Below RC 14.6.";
          else if (lowVal >= fm23 && lowVal < fm14) lowCond = "Above FC 23.6 & Below FC 14.6.";
          else if (lowVal >= fm38 && lowVal < fm23) lowCond = "Above FC 38.2 & Below FC 23.6.";
          else if (lowVal >= fm61 && lowVal < fm38) lowCond = "Above FC 61.8 & Below FC 38.2.";
          else if (lowVal >= fm100 && lowVal < fm61) lowCond = "Above FC 100 & Below FC 61.8.";

          if (highCond === "Above FC 14.6 & Below RC 14.6." && lowCond === "Above FC 100 & Below FC 61.8.") {
            pointer = "Upward Rotation";
            pointerType = "cyan";
          } else if (highCond === "Above RC 23.6 & Below RC 38.2." && lowCond === "Above FC 100 & Below FC 61.8.") {
            pointer = "Table Top";
            pointerType = "purple";
          } else if (highCond === "Above RC 38.2 & Below RC 61.8." && lowCond === "Above FC 61.8 & Below FC 38.2.") {
            pointer = "Table Tennis";
            pointerType = "blue";
          } else if (highCond === "Above RC 61.8 & Below RC 100." && lowCond === "Above FC 23.6 & Below FC 14.6.") {
            pointer = "Rising Jack";
            pointerType = "orange";
          } else if (highCond === "Above RC 61.8 & Below RC 100." && lowCond === "Above FC 14.6 & Below RC 14.6.") {
            pointer = "Falling Duck";
            pointerType = "amber";
          } else {
            pointer = "FALSE";
            pointerType = "neutral";
          }
        } else {
          status = "BASELINE";
          statusType = "neutral";
          pointer = "FALSE";
          pointerType = "neutral";
        }

        // Floor & Ceiling Price based on timeframe
        let floorPrice = lowVal;
        let ceilingPrice = highVal;
        if (prevRow) {
          const tf = (timeframe || "Daily").toLowerCase();
          let windowSize = 5; // Daily: approx 1 week
          if (tf === "weekly") windowSize = 4; // Weekly: approx 1 month
          else if (tf === "monthly") windowSize = 12; // Monthly: approx 1 year
          else if (tf === "quarterly") windowSize = 4;
          else if (tf === "half-yearly" || tf === "halfyearly") windowSize = 2;
          else if (tf === "yearly") windowSize = 5;

          const prevCandles = arr.slice(idx + 1, idx + 1 + windowSize);
          if (prevCandles.length > 0) {
            floorPrice = Math.min(...prevCandles.map((r) => parseNum(r.low)));
            ceilingPrice = Math.max(...prevCandles.map((r) => parseNum(r.high)));
          } else {
            floorPrice = parseNum(prevRow.low);
            ceilingPrice = parseNum(prevRow.high);
          }
        }

        resultRows.push({
          rawId: row.id,
          no: String(globalIndex++).padStart(2, "0"),
          symbol: row.symbol || "—",
          day: getDayOfWeek(row.date),
          date: formatDateDisplay(row.date),
          rawDate: row.date,
          open: formatNum(openVal),
          high: formatNum(highVal),
          low: formatNum(lowVal),
          close: formatNum(closeVal),
          avg: formatNum(avgVal),
          range: formatNum(rangeVal),
          rawOpen: openVal,
          rawHigh: highVal,
          rawLow: lowVal,
          rawClose: closeVal,
          rawAvg: avgVal,
          rawRange: rangeVal,
          status,
          statusType,
          pointer,
          pointerType,
          virgin,
          virginType,
          zone,
          zoneType,
          closure,
          closureType,
          floor: formatNum(floorPrice),
          ceiling: formatNum(ceilingPrice),
        });
      });
    });

    return resultRows;
  }, [rawRecords]);

  // Handle row click / pointer navigation
  const handleOpenRowDetails = (row) => {
    const payload = {
      open: row.rawOpen,
      high: row.rawHigh,
      low: row.rawLow,
      close: row.rawClose,
      range: row.rawRange,
      average: row.rawAvg,
      timeframe,
      symbol: row.symbol,
      script: stripSymbolSuffix(row.symbol),
      date: row.date,
      title: `${stripSymbolSuffix(row.symbol)} (${row.date}) - Strategy Decision Matrix`,
    };

    if (onOpenStrategy) {
      onOpenStrategy(payload);
    } else if (onOpenPointer) {
      onOpenPointer(payload);
    }
  };

  const isAllSymbols = !ticker || ticker === "ALL" || ticker === "ALL_SYMBOLS";

  return (
    <div className="analytics-container">
      {/* TOP FILTER TOOLBAR */}
      <div className="filter-toolbar">
        {/* EXCHANGE */}
        <div className="filter-group">
          <label className="filter-label">Exchange</label>
          <select
            className="apple-select"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
          >
            <option value="ALL">ALL (All Exchanges)</option>
            {availableExchanges.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </div>

        {/* INDEX */}
        <div className="filter-group">
          <label className="filter-label">Index</label>
          <select
            className="apple-select"
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
          >
            <option value="ALL">ALL (All Indices)</option>
            {availableIndices.map((idx) => (
              <option key={idx} value={idx}>
                {idx}
              </option>
            ))}
          </select>
        </div>

        {/* TICKER SYMBOL */}
        <div className="filter-group wide">
          <label className="filter-label">
            Ticker Symbol <span>({symbolsLoading ? "Loading..." : `${availableSymbols.length} Available`})</span>
          </label>
          <select
            className="apple-select"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            disabled={symbolsLoading}
          >
            <option value="ALL">
              {symbolsLoading ? "Loading symbols..." : `ALL - All Symbols (${availableSymbols.length} available)`}
            </option>
            {availableSymbols.map((item) => {
              const sym = typeof item === "string" ? item : item.symbol;
              const cleanSym = stripSymbolSuffix(sym);
              const metaLabel = typeof item === "object" && item.indice
                ? `${cleanSym} — [${item.exchange}] ${item.indice}`
                : typeof item === "object" && item.exchange
                ? `${cleanSym} — [${item.exchange}]`
                : cleanSym;
              return (
                <option key={sym} value={sym}>
                  {metaLabel}
                </option>
              );
            })}
          </select>
        </div>

        {/* FROM DATE */}
        <div className="filter-group">
          <label className="filter-label">From Date</label>
          <input
            type="date"
            className="apple-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* TO DATE */}
        <div className="filter-group">
          <label className="filter-label">To Date</label>
          <input
            type="date"
            className="apple-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* TIMEFRAME */}
        <div className="filter-group">
          <label className="filter-label">Timeframe</label>
          <select
            className="apple-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Half-Yearly">Half Yearly</option>
            <option value="Yearly">Yearly</option>
            <option value="5-Yearly">5 Yearly</option>
          </select>
        </div>

        {/* ACTIONS */}
        <div className="filter-actions" style={{ position: "relative" }}>
          <button
            className="btn-analyze"
            onClick={fetchData}
            disabled={loading}
            type="button"
          >
            <span>{loading ? "⏳" : "🔍"}</span> {loading ? "Loading..." : "Analyze"}
          </button>

          <button className="btn-clear" onClick={handleClear} type="button">
            ✕ Clear
          </button>

          <button
            className="btn-columns"
            onClick={() => setShowColumnsMenu((s) => !s)}
            type="button"
          >
            <span>田</span> Columns
          </button>

          {/* COLUMN VISIBILITY POPOVER */}
          {showColumnsMenu && (
            <div className="columns-menu">
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                Add / Remove Columns
              </span>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.symbol}
                  onChange={() => toggleCol("symbol")}
                />
                Symbol
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.day}
                  onChange={() => toggleCol("day")}
                />
                Day
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.avg}
                  onChange={() => toggleCol("avg")}
                />
                AVG
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.range}
                  onChange={() => toggleCol("range")}
                />
                RANGE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.status}
                  onChange={() => toggleCol("status")}
                />
                STATUS
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.pointer}
                  onChange={() => toggleCol("pointer")}
                />
                POINTER
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.virgin}
                  onChange={() => toggleCol("virgin")}
                />
                VIRGIN
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.zone}
                  onChange={() => toggleCol("zone")}
                />
                ZONE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.closure}
                  onChange={() => toggleCol("closure")}
                />
                CLOSURE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.floor}
                  onChange={() => toggleCol("floor")}
                />
                FLOOR
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.ceiling}
                  onChange={() => toggleCol("ceiling")}
                />
                CEILING PRICE
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          borderRadius: 12,
          padding: "12px 18px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={fetchData}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* MATRIX TABLE CARD */}
      <div className="matrix-card">
        {/* <div className="matrix-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="matrix-title">
              {isAllSymbols && !fromDate && !toDate
                ? "Today's / Latest Stock Analytics Matrix (All Symbols)"
                : isAllSymbols
                ? "All Symbols Stock Analytics Matrix"
                : `${ticker} Analytics Matrix`}
            </span>
            <span style={{
              background: "#e0f2fe",
              color: "#0369a1",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20
            }}>
              {loading
                ? "Fetching records..."
                : isAllSymbols && !fromDate && !toDate
                ? `${processedRows.length} Symbols (Today's Latest Bar)`
                : `${processedRows.length} Total Records (Single Page)`}
            </span>
          </div>
          <div className="matrix-legend">
            <span className="legend-item">
              <span className="legend-pill bullish">HLC HIGHER</span> Bullish
            </span>
            <span className="legend-item">
              <span className="legend-pill bearish">HLC LOWER</span> Bearish
            </span>
            <span className="legend-item">
              <span className="legend-pill breakout">Y1-Y6</span> Breakout
            </span>
            <span className="legend-item">
              <span className="legend-pill virgin-pill">VIRGIN HIGHER</span> Low &gt; Prev. Avg
            </span>
            <span className="legend-item">
              <span className="legend-pill zone-pill">ZONE GREEN</span> Bullish Momentum
            </span>
          </div>
        </div> */}

        <div className="table-scroll">
          <table className="apple-table">
            <thead>
              <tr>
                <th>SR.NO</th>
                {visibleCols.symbol && <th>SYMBOL</th>}
                {visibleCols.day && <th>DAY</th>}
                <th>DATE</th>
                <th>OPEN</th>
                <th>HIGH</th>
                <th>LOW</th>
                <th>CLOSE</th>
                {visibleCols.avg && <th>AVG</th>}
                {visibleCols.range && <th>RANGE</th>}
                {visibleCols.status && <th>STATUS</th>}
                {visibleCols.pointer && <th>POINTER</th>}
                {visibleCols.virgin && <th title="VIRGIN: HIGHER = Low > Prev.Day Avg | LOWER = High < Prev.Day Avg">VIRGIN</th>}
                {visibleCols.zone && <th title="ZONE: GREEN = Close > Prev.Close & Prev.Avg | RED = Close < Prev.Close & Prev.Avg">ZONE</th>}
                {visibleCols.closure && <th title="CLOSURE: HIGH = Close > Prev.High | LOW = Close < Prev.Low">CLOSURE</th>}
                {visibleCols.floor && <th title="FLOOR: Prev. Period Low">FLOOR</th>}
                {visibleCols.ceiling && <th title="CEILING PRICE: Prev. Period High">CEILING PRICE</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>⏳</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Connecting to MySQL &amp; Loading All Stock Records...</span>
                    </div>
                  </td>
                </tr>
              ) : processedRows.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 32 }}>📊</span>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "#475569" }}>No stock data found for the selected criteria.</span>
                      <span style={{ fontSize: 13 }}>Try selecting "ALL - All Symbols", picking a different timeframe, or adjusting date filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedRows.map((row) => {
                  const pInfo = getPointerInfo(row.pointer);
                  return (
                    <tr key={`${row.symbol}-${row.rawId || row.rawDate || row.no}`}>
                      <td className="serial-col">{row.no}</td>
                      {visibleCols.symbol && (
                        <td style={{ fontWeight: 700, color: "#1e293b" }}>
                          {stripSymbolSuffix(row.symbol)}
                        </td>
                      )}
                      {visibleCols.day && <td>{row.day}</td>}
                      <td>{row.date}</td>
                      <td>{row.open}</td>
                      <td className="high-green">{row.high}</td>
                      <td className={row.statusType === "bearish" ? "low-red" : ""}>
                        {row.low}
                      </td>
                      <td>{row.close}</td>
                      {visibleCols.avg && <td>{row.avg}</td>}
                      {visibleCols.range && <td>{row.range}</td>}
                      {visibleCols.status && (
                        <td>
                          <span className={`hlc-badge ${row.statusType}`}>
                            {row.status}
                          </span>
                        </td>
                      )}
                      {visibleCols.pointer && (
                        <td>
                          <span
                            className={`pointer-tag ${pInfo.type || row.pointerType || "orange"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleOpenRowDetails(row)}
                            title={`Click to view Strategy Decision Matrix (${pInfo.name || row.pointer})`}
                          >
                            <span className="pointer-code">{pInfo.code}</span>
                            {pInfo.name && <span className="pointer-name">{pInfo.name}</span>}
                            <span className="pointer-arrow">↗</span>
                          </span>
                        </td>
                      )}
                      {visibleCols.virgin && (
                        <td>
                          <span className={`analytics-pill virgin-${row.virginType}`}>
                            {row.virgin}
                          </span>
                        </td>
                      )}
                      {visibleCols.zone && (
                        <td>
                          <span className={`analytics-pill zone-${row.zoneType}`}>
                            {row.zone}
                          </span>
                        </td>
                      )}
                      {visibleCols.closure && (
                        <td>
                          <span className={`analytics-pill closure-${row.closureType}`}>
                            {row.closure}
                          </span>
                        </td>
                      )}
                      {visibleCols.floor && (
                        <td className="metric-col floor-val" title={`Floor Price for ${timeframe}`}>
                          {row.floor}
                        </td>
                      )}
                      {visibleCols.ceiling && (
                        <td className="metric-col ceiling-val" title={`Ceiling Price for ${timeframe}`}>
                          {row.ceiling}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
