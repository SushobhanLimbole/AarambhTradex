import React, { useState } from "react";
import "./StockAnalytics.css";

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

export default function StockAnalytics() {
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
    pointer: true,
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

  return (
    <div className="analytics-container">
      {/* TOP FILTER TOOLBAR (MATCHING SCREENSHOT 2 & SCREENSHOT 1) */}
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
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
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
                  checked={visibleCols.pointer}
                  onChange={() => toggleCol("pointer")}
                />
                POINTER
              </label>
            </div>
          )}
        </div>
      </div>

      {/* MATRIX TABLE CARD */}
      <div className="matrix-card">
        <div className="matrix-header-bar">
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
          </div>
        </div>

        <div className="table-scroll">
          <table className="apple-table">
            <thead>
              <tr>
                <th>SR.NO</th>
                <th>DATE</th>
                {visibleCols.day && <th>DAY</th>}
                <th>OPEN</th>
                <th>HIGH</th>
                <th>LOW</th>
                <th>CLOSE</th>
                {visibleCols.avg && <th>AVG</th>}
                {visibleCols.range && <th>RANGE</th>}
                <th>STATUS</th>
                {visibleCols.pointer && <th>POINTER</th>}
              </tr>
            </thead>
            <tbody>
              {INITIAL_ROWS.map((row) => (
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
                  <td>
                    <span className={`hlc-badge ${row.statusType}`}>
                      {row.status}
                    </span>
                  </td>
                  {visibleCols.pointer && (
                    <td>
                      <span className={`pointer-tag ${row.pointerType}`}>
                        {row.pointer}
                      </span>
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
