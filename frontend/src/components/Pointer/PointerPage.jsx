import React, { useState, useMemo } from "react";
import "./PointerPage.css";

// 9 Fibonacci Ratio Columns matching the institutional specification
const FIB_COLUMNS = [14.6, 23.6, 38.2, 61.8, 100, 127.2, 161.8, 261.8, 423.6];

// Preset Scenarios
const PRESETS = [
  {
    name: "Master Reference (Screenshot)",
    open: 962.0,
    high: 1163.0,
    low: 962.0,
    close: 1130.6,
    timeframe: "Daily",
  },
  {
    name: "NIFTY 50 (Index)",
    open: 24780.0,
    high: 25150.0,
    low: 24690.0,
    close: 25080.5,
    timeframe: "Daily",
  },
  {
    name: "BANK NIFTY (Index)",
    open: 51200.0,
    high: 51980.0,
    low: 50950.0,
    close: 51760.0,
    timeframe: "Daily",
  },
  {
    name: "RELIANCE IND.",
    open: 2980.5,
    high: 3025.0,
    low: 2972.1,
    close: 3018.4,
    timeframe: "Daily",
  },
  {
    name: "TATA MOTORS",
    open: 1045.0,
    high: 1092.5,
    low: 1038.0,
    close: 1084.2,
    timeframe: "Daily",
  },
  {
    name: "HDFC BANK",
    open: 1620.0,
    high: 1665.0,
    low: 1615.0,
    close: 1658.0,
    timeframe: "Daily",
  },
];

export default function PointerPage({ initialData }) {
  // Input states
  const [open, setOpen] = useState(initialData?.open ?? 962.0);
  const [high, setHigh] = useState(initialData?.high ?? 1163.0);
  const [low, setLow] = useState(initialData?.low ?? 962.0);
  const [close, setClose] = useState(initialData?.close ?? 1130.6);
  const [timeframe, setTimeframe] = useState(initialData?.timeframe ?? "Daily");
  const [copiedText, setCopiedText] = useState(null);
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialData?.title ? "Custom / Selected Stock" : "Master Reference (Screenshot)"
  );

  React.useEffect(() => {
    if (initialData) {
      if (initialData.open !== undefined) setOpen(initialData.open);
      if (initialData.high !== undefined) setHigh(initialData.high);
      if (initialData.low !== undefined) setLow(initialData.low);
      if (initialData.close !== undefined) setClose(initialData.close);
      if (initialData.timeframe) setTimeframe(initialData.timeframe);
      if (initialData.title) setSelectedPresetName(initialData.title);
    }
  }, [initialData]);

  // Formatting helper
  const fmt = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return "—";
    return Number(num).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Mathematical Calculation Engine
  const calcs = useMemo(() => {
    const o = parseFloat(open) || 0;
    const h = parseFloat(high) || 0;
    const l = parseFloat(low) || 0;
    const c = parseFloat(close) || 0;

    const range = Math.max(0, h - l);
    const average = (h + l + c) / 3;
    const highLow = (h + l) / 2;
    const lowClose = (l + c) / 2;
    const highClose = (h + c) / 2;

    // Rising Channel computations
    // Green main row (Close + Range * Ratio)
    const risingMain = {
      14.6: c + range * 0.146,
      23.6: c + range * 0.236,
      38.2: c + range * 0.382,
      61.8: c + range * 0.618,
      100: c + range * 1.0,
      127.2: c + range * 1.272,
      161.8: c + range * 1.618,
      261.8: c + range * 2.618,
      423.6: c + range * 4.236,
    };

    // Rising Upper band
    const risingUpper = {
      14.6: c + range * 0.1804,
      23.6: risingMain[23.6], // Pivot Level in Yellow
      38.2: c + range * 0.4721,
      61.8: risingMain[61.8] + range * 0.146,
      100: risingMain[100] + range * 0.1039,
      127.2: risingMain[127.2] + range * 0.1322,
      161.8: risingMain[161.8] + range * 0.382,
      261.8: risingMain[261.8] + range * 0.618,
      423.6: null,
    };

    // Rising Lower band
    const risingLower = {
      14.6: c + range * 0.0345,
      23.6: risingMain[23.6], // Pivot Level in Yellow
      38.2: c + range * 0.3262,
      61.8: risingMain[61.8] - range * 0.0901,
      100: risingMain[100] - range * 0.146,
      127.2: risingMain[127.2] - range * 0.1039,
      161.8: risingMain[161.8] - range * 0.1322,
      261.8: risingMain[261.8] - range * 0.382,
      423.6: null,
    };

    // Falling Channel computations
    // Red main row (Close - Range * Ratio)
    const fallingMain = {
      14.6: c - range * 0.146,
      23.6: c - range * 0.236,
      38.2: c - range * 0.382,
      61.8: c - range * 0.618,
      100: c - range * 1.0,
      127.2: c - range * 1.272,
      161.8: c - range * 1.618,
      261.8: c - range * 2.618,
      423.6: c - range * 4.236,
    };

    // Falling Upper band
    const fallingUpper = {
      14.6: c - range * 0.0345,
      23.6: fallingMain[23.6], // Pivot Level in Yellow
      38.2: c - range * 0.3262,
      61.8: fallingMain[61.8] + range * 0.0901,
      100: fallingMain[100] + range * 0.146,
      127.2: fallingMain[127.2] + range * 0.1039,
      161.8: fallingMain[161.8] + range * 0.1322,
      261.8: fallingMain[261.8] + range * 0.382,
      423.6: null,
    };

    // Falling Lower band
    const fallingLower = {
      14.6: c - range * 0.1804,
      23.6: fallingMain[23.6], // Pivot Level in Yellow
      38.2: c - range * 0.4721,
      61.8: fallingMain[61.8] - range * 0.146,
      100: fallingMain[100] - range * 0.1039,
      127.2: fallingMain[127.2] - range * 0.1322,
      161.8: fallingMain[161.8] - range * 0.382,
      261.8: fallingMain[261.8] - range * 0.618,
      423.6: null,
    };

    return {
      range,
      average,
      highLow,
      lowClose,
      highClose,
      risingMain,
      risingUpper,
      risingLower,
      fallingMain,
      fallingUpper,
      fallingLower,
    };
  }, [open, high, low, close]);

  const loadPreset = (preset) => {
    setSelectedPresetName(preset.name);
    setOpen(preset.open);
    setHigh(preset.high);
    setLow(preset.low);
    setClose(preset.close);
    setTimeframe(preset.timeframe);
  };

  const handleCopy = (val, label) => {
    if (val === null || val === undefined) return;
    const text = typeof val === "number" ? val.toFixed(2) : String(val);
    navigator.clipboard?.writeText(text);
    setCopiedText(`${label || "Value"}: ${text}`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="pointer-page-wrapper">
      {/* HEADER HERO BAR */}
      <div className="pointer-header-container">
        {/* <div className="pointer-title-area">
          <div className="pointer-badge-pill">
            <span className="pointer-pulsing-dot"></span>
            <span>INSTITUTIONAL POINTER ENGINE</span>
          </div>
          <h1 className="pointer-heading">Pointer Fibonacci Channel Matrix</h1>
          <p className="pointer-subheading">
            Continuous staircase alignment across Fibonacci channels, volatility buffer bands, and breakout pivots.
          </p>
        </div> */}

        {/* HORIZONTAL TIMEFRAME TAB SELECTOR */}
        <div className="pointer-timeframe-tab-bar">
          {["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "5-Yearly"].map((tf) => (
            <button
              key={tf}
              type="button"
              className={`timeframe-tab-btn ${timeframe === tf ? "active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* COPIED TOAST NOTIFICATION */}
      {copiedText && (
        <div className="pointer-toast">
          <span className="toast-icon">✓</span>
          <span>Copied to clipboard: <strong>{copiedText}</strong></span>
        </div>
      )}

      {/* MAIN CARD CONTAINER */}
      <div className="pointer-matrix-card">
        <div className="pointer-compact-layout">
          
          {/* ========================================================= */}
          {/* RIGHT MATRIX: CONTINUOUS STAIRCASE (EXACT MATCHING ROWS)  */}
          {/* ========================================================= */}
          <div className="pointer-compact-matrix">
            
            {/* TOP FIBONACCI RATIO HEADER */}
            <div className="fib-header-row top-header">
              {FIB_COLUMNS.map((fib) => (
                <div key={`top-${fib}`} className="fib-header-cell">
                  {fib}
                </div>
              ))}
            </div>

            {/* MATRIX BODY */}
            <div className="matrix-staircase-body">

              {/* ----------------------------------------------------- */}
              {/* RISING CHANNEL STAIRCASE (CONTINUOUS OVERLAP)         */}
              {/* ----------------------------------------------------- */}
              <div className="channel-staircase-section rising">
                
                {/* ROW 1: Zone 3 Upper (1412.84, 1532.60, 1781.05) */}
                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[127.2], "Rising 127.2 (Upper)")}
                    title="Rising 127.2% Upper Target"
                  >
                    {fmt(calcs.risingUpper[127.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[161.8], "Rising 161.8 (Upper)")}
                    title="Rising 161.8% Upper Target"
                  >
                    {fmt(calcs.risingUpper[161.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[261.8], "Rising 261.8 (Upper)")}
                    title="Rising 261.8% Upper Target"
                  >
                    {fmt(calcs.risingUpper[261.8])}
                  </div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                {/* ROW 2: Zone 3 Green Main (1386.27, 1455.82, 1656.82, 1982.04) */}
                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[127.2], "Rising 127.2 (Main)")}
                    title="Rising 127.2% Level"
                  >
                    {fmt(calcs.risingMain[127.2])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[161.8], "Rising 161.8 (Main)")}
                    title="Rising 161.8% Level"
                  >
                    {fmt(calcs.risingMain[161.8])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[261.8], "Rising 261.8 (Main)")}
                    title="Rising 261.8% Level"
                  >
                    {fmt(calcs.risingMain[261.8])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[423.6], "Rising 423.6 (Golden)")}
                    title="Rising 423.6% Golden Level"
                  >
                    {fmt(calcs.risingMain[423.6])}
                  </div>
                </div>



                {/* ROW 4: [1,352.48 IN LINE WITH 1,365.39] */}
                {/* Zone 2 Upper (1284.15, 1352.48) + Zone 3 Lower (1365.39, 1429.25, 1580.04) */}
                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[61.8], "Rising 61.8 (Upper)")}
                    title="Rising 61.8% Upper Target"
                  >
                    {fmt(calcs.risingUpper[61.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[100], "Rising 100 (Upper)")}
                    title="Rising 100.0% Upper Target"
                  >
                    {fmt(calcs.risingUpper[100])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[127.2], "Rising 127.2 (Lower)")}
                    title="Rising 127.2% Lower Support"
                  >
                    {fmt(calcs.risingLower[127.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[161.8], "Rising 161.8 (Lower)")}
                    title="Rising 161.8% Lower Support"
                  >
                    {fmt(calcs.risingLower[161.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[261.8], "Rising 261.8 (Lower)")}
                    title="Rising 261.8% Lower Support"
                  >
                    {fmt(calcs.risingLower[261.8])}
                  </div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                {/* ROW 5: Zone 2 Green Main (1254.82, 1331.60) */}
                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[61.8], "Rising 61.8 (Main)")}
                    title="Rising 61.8% Level"
                  >
                    {fmt(calcs.risingMain[61.8])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[100], "Rising 100 (Main)")}
                    title="Rising 100.0% Level"
                  >
                    {fmt(calcs.risingMain[100])}
                  </div>
                  <div className="stair-offset offset-4"></div>
                </div>



                {/* ROW 7: [1,225.50 IN LINE WITH 1,236.70] */}
                {/* Zone 1 Upper (1166.86, 1178.04, 1225.50) + Zone 2 Lower (1236.70, 1302.27) */}
                <div className="stair-row">
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[14.6], "Rising 14.6 (Upper)")}
                    title="Rising 14.6% Upper Target"
                  >
                    {fmt(calcs.risingUpper[14.6])}
                  </div>
                  <div
                    className="stair-cell yellow-highlight-cell"
                    onClick={() => handleCopy(calcs.risingUpper[23.6], "Rising 23.6 (Pivot)")}
                    title="Rising 23.6% Pivot Level"
                  >
                    {fmt(calcs.risingUpper[23.6])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingUpper[38.2], "Rising 38.2 (Upper)")}
                    title="Rising 38.2% Upper Target"
                  >
                    {fmt(calcs.risingUpper[38.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[61.8], "Rising 61.8 (Lower)")}
                    title="Rising 61.8% Lower Support"
                  >
                    {fmt(calcs.risingLower[61.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[100], "Rising 100 (Lower)")}
                    title="Rising 100.0% Lower Support"
                  >
                    {fmt(calcs.risingLower[100])}
                  </div>
                  <div className="stair-offset offset-4"></div>
                </div>

                {/* ROW 8: Zone 1 Green Main (1159.95, 1178.04 [GREEN], 1207.38) */}
                <div className="stair-row">
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[14.6], "Rising 14.6 (Main)")}
                    title="Rising 14.6% Level"
                  >
                    {fmt(calcs.risingMain[14.6])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[23.6], "Rising 23.6 (Main Green)")}
                    title="Rising 23.6% Level (Green)"
                  >
                    {fmt(calcs.risingMain[23.6])}
                  </div>
                  <div
                    className="stair-cell green-cell"
                    onClick={() => handleCopy(calcs.risingMain[38.2], "Rising 38.2 (Main)")}
                    title="Rising 38.2% Level"
                  >
                    {fmt(calcs.risingMain[38.2])}
                  </div>
                  <div className="stair-offset offset-6"></div>
                </div>



                {/* ROW 10: Zone 1 Lower (1137.53, 1178.04 [YELLOW], 1196.17) */}
                <div className="stair-row">
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[14.6], "Rising 14.6 (Lower)")}
                    title="Rising 14.6% Lower Support"
                  >
                    {fmt(calcs.risingLower[14.6])}
                  </div>
                  <div
                    className="stair-cell yellow-highlight-cell"
                    onClick={() => handleCopy(calcs.risingLower[23.6], "Rising 23.6 (Pivot)")}
                    title="Rising 23.6% Pivot Level"
                  >
                    {fmt(calcs.risingLower[23.6])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.risingLower[38.2], "Rising 38.2 (Lower)")}
                    title="Rising 38.2% Lower Support"
                  >
                    {fmt(calcs.risingLower[38.2])}
                  </div>
                  <div className="stair-offset offset-6"></div>
                </div>

              </div>

              {/* ----------------------------------------------------- */}
              {/* THE MASTER HORIZONTAL DIVIDER WITH CLOSE PRICE        */}
              {/* ----------------------------------------------------- */}
              <div className="matrix-horizontal-divider">
                <div className="divider-line"></div>
                <div
                  className="divider-close-badge"
                  onClick={() => handleCopy(close, "Close Price")}
                  title="Click to copy Close Price"
                >
                  <span className="close-badge-label">CLOSE PRICE</span>
                  <span className="close-badge-val">{fmt(close)}</span>
                </div>
                <div className="divider-line"></div>
              </div>

              {/* ----------------------------------------------------- */}
              {/* FALLING CHANNEL STAIRCASE (CONTINUOUS OVERLAP)        */}
              {/* ----------------------------------------------------- */}
              <div className="channel-staircase-section falling">
                
                {/* ROW 1: Falling Zone 1 Upper (1123.67, 1083.16 [YELLOW], 1065.03) */}
                <div className="stair-row">
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[14.6], "Falling 14.6 (Upper)")}
                    title="Falling 14.6% Retracement"
                  >
                    {fmt(calcs.fallingUpper[14.6])}
                  </div>
                  <div
                    className="stair-cell yellow-highlight-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[23.6], "Falling 23.6 (Pivot)")}
                    title="Falling 23.6% Pivot Level"
                  >
                    {fmt(calcs.fallingUpper[23.6])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[38.2], "Falling 38.2 (Upper)")}
                    title="Falling 38.2% Retracement"
                  >
                    {fmt(calcs.fallingUpper[38.2])}
                  </div>
                  <div className="stair-offset offset-6"></div>
                </div>

                {/* ROW 2: Falling Zone 1 Red Main (1101.25, 1083.16 [RED], 1053.82) */}
                <div className="stair-row">
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[14.6], "Falling 14.6 (Main)")}
                    title="Falling 14.6% Level"
                  >
                    {fmt(calcs.fallingMain[14.6])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[23.6], "Falling 23.6 (Main Red)")}
                    title="Falling 23.6% Level (Red)"
                  >
                    {fmt(calcs.fallingMain[23.6])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[38.2], "Falling 38.2 (Main)")}
                    title="Falling 38.2% Level"
                  >
                    {fmt(calcs.fallingMain[38.2])}
                  </div>
                  <div className="stair-offset offset-6"></div>
                </div>



                {/* ROW 4: [1035.70 IN LINE WITH 1024.50] */}
                {/* Zone 1 Lower (1094.34, 1083.16, 1035.70) + Zone 2 Upper (1024.50, 958.93) */}
                <div className="stair-row">
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[14.6], "Falling 14.6 (Lower)")}
                    title="Falling 14.6% Lower Target"
                  >
                    {fmt(calcs.fallingLower[14.6])}
                  </div>
                  <div
                    className="stair-cell yellow-highlight-cell"
                    onClick={() => handleCopy(calcs.fallingLower[23.6], "Falling 23.6 (Pivot)")}
                    title="Falling 23.6% Pivot Level"
                  >
                    {fmt(calcs.fallingLower[23.6])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[38.2], "Falling 38.2 (Lower)")}
                    title="Falling 38.2% Lower Target"
                  >
                    {fmt(calcs.fallingLower[38.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[61.8], "Falling 61.8 (Upper)")}
                    title="Falling 61.8% Upper Target"
                  >
                    {fmt(calcs.fallingUpper[61.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[100], "Falling 100 (Upper)")}
                    title="Falling 100.0% Upper Target"
                  >
                    {fmt(calcs.fallingUpper[100])}
                  </div>
                  <div className="stair-offset offset-4"></div>
                </div>

                {/* ROW 5: Falling Zone 2 Red Main (1006.38, 929.60) */}
                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[61.8], "Falling 61.8 (Main)")}
                    title="Falling 61.8% Level"
                  >
                    {fmt(calcs.fallingMain[61.8])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[100], "Falling 100 (Main)")}
                    title="Falling 100.0% Level"
                  >
                    {fmt(calcs.fallingMain[100])}
                  </div>
                  <div className="stair-offset offset-4"></div>
                </div>



                {/* ROW 7: [908.72 IN LINE WITH 895.81] */}
                {/* Zone 2 Lower (977.05, 908.72) + Zone 3 Upper (895.81, 831.95, 681.16) */}
                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[61.8], "Falling 61.8 (Lower)")}
                    title="Falling 61.8% Lower Target"
                  >
                    {fmt(calcs.fallingLower[61.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[100], "Falling 100 (Lower)")}
                    title="Falling 100.0% Lower Target"
                  >
                    {fmt(calcs.fallingLower[100])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[127.2], "Falling 127.2 (Upper)")}
                    title="Falling 127.2% Retracement"
                  >
                    {fmt(calcs.fallingUpper[127.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[161.8], "Falling 161.8 (Upper)")}
                    title="Falling 161.8% Retracement"
                  >
                    {fmt(calcs.fallingUpper[161.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingUpper[261.8], "Falling 261.8 (Upper)")}
                    title="Falling 261.8% Retracement"
                  >
                    {fmt(calcs.fallingUpper[261.8])}
                  </div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                {/* ROW 8: Falling Zone 3 Red Main (874.93, 805.38, 604.38, 279.16) */}
                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[127.2], "Falling 127.2 (Main)")}
                    title="Falling 127.2% Level"
                  >
                    {fmt(calcs.fallingMain[127.2])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[161.8], "Falling 161.8 (Main)")}
                    title="Falling 161.8% Level"
                  >
                    {fmt(calcs.fallingMain[161.8])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[261.8], "Falling 261.8 (Main)")}
                    title="Falling 261.8% Level"
                  >
                    {fmt(calcs.fallingMain[261.8])}
                  </div>
                  <div
                    className="stair-cell red-cell"
                    onClick={() => handleCopy(calcs.fallingMain[423.6], "Falling 423.6 (Deep)")}
                    title="Falling 423.6% Deep Extension"
                  >
                    {fmt(calcs.fallingMain[423.6])}
                  </div>
                </div>



                {/* ROW 10: Falling Zone 3 Lower (848.36, 728.60, 480.15) */}
                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[127.2], "Falling 127.2 (Lower)")}
                    title="Falling 127.2% Lower Target"
                  >
                    {fmt(calcs.fallingLower[127.2])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[161.8], "Falling 161.8 (Lower)")}
                    title="Falling 161.8% Lower Target"
                  >
                    {fmt(calcs.fallingLower[161.8])}
                  </div>
                  <div
                    className="stair-cell dark-cell"
                    onClick={() => handleCopy(calcs.fallingLower[261.8], "Falling 261.8 (Lower)")}
                    title="Falling 261.8% Lower Target"
                  >
                    {fmt(calcs.fallingLower[261.8])}
                  </div>
                  <div className="stair-cell empty-cell"></div>
                </div>

              </div>

            </div>

            {/* BOTTOM FIBONACCI RATIO HEADER */}
            <div className="fib-header-row bottom-header">
              {FIB_COLUMNS.map((fib) => (
                <div key={`bottom-${fib}`} className="fib-header-cell">
                  {fib}
                </div>
              ))}
            </div>

          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM OHLC INPUTS & CALCULATED SUMMARY BAR               */}
      {/* ========================================================= */}
      <div className="pointer-summary-section">
        <div className="summary-header-card">
          <div className="summary-col-header blue-head">OPEN</div>
          <div className="summary-col-header yellow-head">High</div>
          <div className="summary-col-header yellow-head">Low</div>
          <div className="summary-col-header yellow-head">Close</div>
          <div className="summary-col-header yellow-head">Average</div>
          <div className="summary-col-header yellow-head">Range</div>
        </div>

        <div className="summary-values-card">
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              title="Click to edit OPEN value"
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={high}
              onChange={(e) => setHigh(e.target.value)}
              title="Click to edit HIGH value"
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={low}
              onChange={(e) => setLow(e.target.value)}
              title="Click to edit LOW value"
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={close}
              onChange={(e) => setClose(e.target.value)}
              title="Click to edit CLOSE value"
            />
          </div>
          <div className="summary-col-val readonly-val" title="Calculated Average (H+L+C)/3">
            {fmt(calcs.average, 1)}
          </div>
          <div className="summary-col-val readonly-val" title="Calculated Range (H-L)">
            {fmt(calcs.range, 0)}
          </div>
        </div>
      </div>

      {/* FOOTER LEGEND */}
      {/* <div className="pointer-footer-legend">
        <div className="legend-chip">
          <span className="chip-dot golden"></span>
          <span><strong>Fibonacci Headers &amp; Pivots (23.6%)</strong>: Key turning inflection levels</span>
        </div>
        <div className="legend-chip">
          <span className="chip-dot emerald"></span>
          <span><strong>Rising Channel</strong>: Bullish targets &amp; expansion staircase</span>
        </div>
        <div className="legend-chip">
          <span className="chip-dot coral"></span>
          <span><strong>Falling Channel</strong>: Bearish supports &amp; breakdown targets</span>
        </div>
        <div className="legend-chip">
          <span className="chip-dot slate"></span>
          <span><strong>Upper/Lower Bands</strong>: Dynamic volatility buffer bands</span>
        </div>
      </div> */}
    </div>
  );
}
