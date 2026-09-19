import React, { useState, useMemo } from "react";
import "./StockAnalytics.css";

// Pointer Descriptive Name Mapping (Aarambh TradeX Institutional Nomenclature)
export const POINTER_DETAILS = {
  "Y1": { code: "Y1", name: "RISING JACK", type: "orange", desc: "Selling Pointer / Rising Jack" },
  "Y2": { code: "Y2", name: "TABLE TENNIS", type: "orange", desc: "Table Tennis Rebound" },
  "Y3": { code: "Y3", name: "BUYING POINTER", type: "orange", desc: "Buying Pointer Expansion" },
  "Y4": { code: "Y4", name: "TABLE TOP", type: "orange", desc: "Table Top Breakout" },
  "Y5": { code: "Y5", name: "RISING BREAKOUT", type: "orange", desc: "Rising Breakout Extension" },
  "Y6": { code: "Y6", name: "POWER JACK", type: "orange", desc: "Power Jack Momentum" },
  "R1": { code: "R1", name: "FALLING JACK", type: "red", desc: "Falling Jack Reversal" },
  "R2": { code: "R2", name: "TABLE TOP", type: "red", desc: "Table Top Breakdown" },
  "R3": { code: "R3", name: "SELLING POINTER", type: "red", desc: "Selling Pointer Pressure" },
  "R4": { code: "R4", name: "FALLING BREAKDOWN", type: "red", desc: "Falling Breakdown Channel" },
  "R5": { code: "R5", name: "CRASH POINTER", type: "red", desc: "Crash Pointer Selloff" },
  "R6": { code: "R6", name: "PANIC DROP", type: "red", desc: "Panic Drop Extension" },
  "G-BUY": { code: "G-BUY", name: "GOLDEN BUY", type: "green", desc: "Golden Ratio Long Signal" },
  "G-SELL": { code: "G-SELL", name: "GOLDEN SELL", type: "green", desc: "Golden Ratio Short Signal" },
};

export const getPointerInfo = (code) => {
  if (!code) return { code: "—", name: "", type: "orange" };
  const upper = String(code).trim().toUpperCase();
  if (POINTER_DETAILS[upper]) return POINTER_DETAILS[upper];
  return { code, name: code, type: "orange" };
};

const INITIAL_ROWS = [
  {
    no: "01",
    day: "Fri",
    date: "06-Sep-2024",
    open: "2,980.50",
    high: "3,025.00",
    low: "2,972.10",
    close: "3,018.40",
    avg: "3,005.15",
    range: "52.90",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "Y3",
    pointerType: "orange",
  },
  {
    no: "02",
    day: "Thu",
    date: "05-Sep-2024",
    open: "2,995.00",
    high: "3,004.80",
    low: "2,960.00",
    close: "2,975.20",
    avg: "2,982.40",
    range: "44.80",
    status: "HLC LOWER",
    statusType: "bearish",
    pointer: "R2",
    pointerType: "red",
  },
  {
    no: "03",
    day: "Wed",
    date: "04-Sep-2024",
    open: "2,940.00",
    high: "3,002.50",
    low: "2,935.00",
    close: "2,998.10",
    avg: "2,968.75",
    range: "67.50",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "G-BUY",
    pointerType: "green",
  },
  {
    no: "04",
    day: "Tue",
    date: "03-Sep-2024",
    open: "2,925.00",
    high: "2,950.00",
    low: "2,918.00",
    close: "2,945.30",
    avg: "2,934.00",
    range: "32.00",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "Y1",
    pointerType: "orange",
  },
  {
    no: "05",
    day: "Mon",
    date: "02-Sep-2024",
    open: "2,960.00",
    high: "2,965.00",
    low: "2,915.20",
    close: "2,921.00",
    avg: "2,940.10",
    range: "49.80",
    status: "HLC LOWER",
    statusType: "bearish",
    pointer: "R1",
    pointerType: "red",
  },
  {
    no: "06",
    day: "Fri",
    date: "30-Aug-2024",
    open: "2,920.00",
    high: "2,975.00",
    low: "2,910.00",
    close: "2,968.45",
    avg: "2,942.50",
    range: "65.00",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "Y6",
    pointerType: "orange",
  },
  {
    no: "07",
    day: "Thu",
    date: "29-Aug-2024",
    open: "2,945.00",
    high: "2,952.10",
    low: "2,905.00",
    close: "2,912.80",
    avg: "2,928.55",
    range: "47.10",
    status: "HLC LOWER",
    statusType: "bearish",
    pointer: "R4",
    pointerType: "red",
  },
  {
    no: "08",
    day: "Wed",
    date: "28-Aug-2024",
    open: "2,910.00",
    high: "2,955.00",
    low: "2,902.00",
    close: "2,949.60",
    avg: "2,928.50",
    range: "53.00",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "Y3",
    pointerType: "orange",
  },
  {
    no: "09",
    day: "Tue",
    date: "27-Aug-2024",
    open: "2,885.00",
    high: "2,918.00",
    low: "2,875.00",
    close: "2,912.40",
    avg: "2,896.50",
    range: "43.00",
    status: "HLC HIGHER",
    statusType: "bullish",
    pointer: "G-BUY",
    pointerType: "green",
  },
  {
    no: "10",
    day: "Mon",
    date: "26-Aug-2024",
    open: "2,915.00",
    high: "2,924.00",
    low: "2,870.00",
    close: "2,880.00",
    avg: "2,897.00",
    range: "54.00",
    status: "HLC LOWER",
    statusType: "bearish",
    pointer: "R1",
    pointerType: "red",
  },
];

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

export default function StockAnalytics({ onOpenPointer }) {
  // Filter States
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("All Indices");
  const [ticker, setTicker] = useState("20MICRONS - 20 Microns Limited");
  const [fromDate, setFromDate] = useState("2026-03-12");
  const [toDate, setToDate] = useState("2026-09-12");
  const [timeframe, setTimeframe] = useState("Daily");

  // Column Visibility States
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
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

  const handleClear = () => {
    setExchange("NSE");
    setIndexVal("All Indices");
    setTicker("20MICRONS - 20 Microns Limited");
    setFromDate("2026-03-12");
    setToDate("2026-09-12");
    setTimeframe("Daily");
  };

  // Compute calculated analytics columns dynamically
  const processedRows = useMemo(() => {
    return INITIAL_ROWS.map((row, idx, arr) => {
      const prevRow = arr[idx + 1]; // Next item is previous date chronologically

      const lowVal = parseNum(row.low);
      const highVal = parseNum(row.high);
      const closeVal = parseNum(row.close);

      let virgin = "—";
      let virginType = "neutral";
      let zone = "—";
      let zoneType = "neutral";
      let closure = "—";
      let closureType = "neutral";

      if (prevRow) {
        const prevAvg = parseNum(prevRow.avg);
        const prevClose = parseNum(prevRow.close);
        const prevHigh = parseNum(prevRow.high);
        const prevLow = parseNum(prevRow.low);

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
      }

      // 4. FLOOR & 5. CEILING PRICE based on timeframe
      // For Daily: Prev. Week Low / High
      // For Weekly: Prev. Month Low / High
      // For Monthly: Prev. Year Low / High
      let floorPrice = 2910.00;
      let ceilingPrice = 3025.00;

      if (timeframe === "Weekly") {
        floorPrice = 2870.00;
        ceilingPrice = 3080.00;
      } else if (timeframe === "Monthly") {
        floorPrice = 2650.00;
        ceilingPrice = 3250.00;
      } else if (timeframe === "Yearly" || timeframe === "5-Yearly") {
        floorPrice = 2100.00;
        ceilingPrice = 3800.00;
      } else {
        // Daily: Contextual relative floor / ceiling
        if (idx < 5) {
          floorPrice = 2910.00; // Previous week low (rows 6-10)
          ceilingPrice = 2975.00; // Previous week high (rows 6-10)
        } else {
          floorPrice = 2870.00;
          ceilingPrice = 2955.00;
        }
      }

      return {
        ...row,
        virgin,
        virginType,
        zone,
        zoneType,
        closure,
        closureType,
        floor: formatNum(floorPrice),
        ceiling: formatNum(ceilingPrice),
      };
    });
  }, [timeframe]);

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
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="MCX">MCX</option>
            <option value="MCX">Crypto </option>
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
            <option value="All Indices">All Indices...</option>
            <option value="NIFTY 50">NIFTY 50</option>
            <option value="NIFTY BANK">NIFTY BANK</option>
            <option value="SENSEX">SENSEX</option>
          </select>
        </div>

        {/* TICKER SYMBOL */}
        <div className="filter-group wide">
          <label className="filter-label">
            Ticker Symbol <span>(All Stocks)</span>
          </label>
          <select
            className="apple-select"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          >
            <option value="20MICRONS - 20 Microns Limited">20MICRONS - 20 Microns Limited</option>
            <option value="RELIANCE - Reliance Industries Limited">RELIANCE - Reliance Industries Limited</option>
            <option value="TCS - Tata Consultancy Services">TCS - Tata Consultancy Services</option>
            <option value="INFY - Infosys Limited">INFY - Infosys Limited</option>
            <option value="HDFCBANK - HDFC Bank Limited">HDFCBANK - HDFC Bank Limited</option>
            <option value="TATAMOTORS - Tata Motors Limited">TATAMOTORS - Tata Motors Limited</option>
            <option value="ICICIBANK - ICICI Bank Limited">ICICIBANK - ICICI Bank Limited</option>
            <option value="SBIN - State Bank of India">SBIN - State Bank of India</option>
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
          <button className="btn-analyze" onClick={() => alert(`Analyzing ${ticker}...`)}>
            <span>🔍</span> Analyze
          </button>

          <button className="btn-clear" onClick={handleClear}>
            ✕ Clear
          </button>

          <button
            className="btn-columns"
            onClick={() => setShowColumnsMenu((s) => !s)}
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

      {/* MATRIX TABLE CARD */}
      <div className="matrix-card">
        {/* <div className="matrix-header-bar">
          <span className="matrix-title">Institutional Analytical Matrix</span>
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
              {processedRows.map((row) => (
                <tr key={row.no}>
                  <td className="serial-col">{row.no}</td>
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
                      {(() => {
                        const pInfo = getPointerInfo(row.pointer);
                        return (
                          <span
                            className={`pointer-tag ${pInfo.type || row.pointerType || "orange"}`}
                            style={{ cursor: onOpenPointer ? "pointer" : "default" }}
                            onClick={() => onOpenPointer && onOpenPointer(row)}
                            title={`Click to view full Pointer Fibonacci Matrix (${pInfo.name || row.pointer})`}
                          >
                            <span className="pointer-code">{pInfo.code}</span>
                            <span className="pointer-name">{pInfo.name}</span>
                            <span className="pointer-arrow">↗</span>
                          </span>
                        );
                      })()}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
