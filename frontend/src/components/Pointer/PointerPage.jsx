import React, { useState, useMemo } from "react";
import "./PointerPage.css";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { screenerService } from "../../services/screenerService.js";

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
  {
    name: "BTC-USD (Bitcoin)",
    open: 62800.0,
    high: 64200.0,
    low: 62100.0,
    close: 63850.0,
    timeframe: "Daily",
  },
  {
    name: "XAUUSD=X (Gold Spot)",
    open: 2570.0,
    high: 2615.0,
    low: 2565.0,
    close: 2608.5,
    timeframe: "Daily",
  },
];

const TIMEFRAMES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "5-Yearly"];

const normalizeTimeframe = (tf) => {
  if (!tf) return "Daily";
  const str = String(tf).trim().toLowerCase();
  if (str === "daily") return "Daily";
  if (str === "weekly") return "Weekly";
  if (str === "monthly") return "Monthly";
  if (str === "quarterly") return "Quarterly";
  if (str === "half-yearly" || str === "halfyearly") return "Half-Yearly";
  if (str === "yearly") return "Yearly";
  if (str === "5-yearly" || str === "5yearly") return "5-Yearly";
  return tf.charAt(0).toUpperCase() + tf.slice(1).toLowerCase();
};

const createDefaultPointerPages = (
  baseOpen = 962.0,
  baseHigh = 1163.0,
  baseLow = 962.0,
  baseClose = 1130.6,
  baseTimeframe = "Daily"
) => {
  const normBaseTf = normalizeTimeframe(baseTimeframe);
  const multipliers = {
    "Daily": 1.0,
    "Weekly": 1.4,
    "Monthly": 2.2,
    "Quarterly": 3.5,
    "Half-Yearly": 4.8,
    "Yearly": 6.5,
    "5-Yearly": 10.0,
  };

  const baseMult = multipliers[normBaseTf] || 1.0;
  const pages = {};
  TIMEFRAMES.forEach((tf) => {
    if (tf === normBaseTf) {
      pages[tf] = {
        open: Number(baseOpen),
        high: Number(baseHigh),
        low: Number(baseLow),
        close: Number(baseClose),
      };
    } else {
      const mult = (multipliers[tf] || 1.0) / baseMult;
      const mid = (baseHigh + baseLow) / 2;
      const halfR = ((baseHigh - baseLow) * mult) / 2;
      pages[tf] = {
        open: Number(baseOpen.toFixed(2)),
        high: Number((mid + halfR).toFixed(2)),
        low: Number(Math.max(1, mid - halfR).toFixed(2)),
        close: Number(baseClose.toFixed(2)),
      };
    }
  });
  return pages;
};

export default function PointerPage({ initialData, onBack, previousTab = "reports", readOnly = false, showTabSelector = true }) {
  const isReadOnly = Boolean(readOnly || initialData?.isReadOnly);
  const shouldShowTabSelector = showTabSelector !== false && !initialData?.isReadOnly;

  const [scriptName, setScriptName] = useState(initialData?.script ?? "Selected Stock");
  const [timeframe, setTimeframe] = useState(normalizeTimeframe(initialData?.timeframe ?? "Daily"));
  const [copiedText, setCopiedText] = useState(null);
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialData?.title ? "Custom / Selected Stock" : "Master Reference (Screenshot)"
  );

  // 7-Page Independent State System
  const [timeframePages, setTimeframePages] = useState(() => {
    const initTf = normalizeTimeframe(initialData?.timeframe ?? "Daily");
    return createDefaultPointerPages(
      initialData?.open ?? 962.0,
      initialData?.high ?? 1163.0,
      initialData?.low ?? 962.0,
      initialData?.close ?? 1130.6,
      initTf
    );
  });

  // Active timeframe values
  const currentData = timeframePages[timeframe] || { open: 962.0, high: 1163.0, low: 962.0, close: 1130.6 };
  const open = currentData.open;
  const high = currentData.high;
  const low = currentData.low;
  const close = currentData.close;

  const setOpen = (val) => {
    if (isReadOnly) return;
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], open: val },
    }));
  };

  const setHigh = (val) => {
    if (isReadOnly) return;
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], high: val },
    }));
  };

  const setLow = (val) => {
    if (isReadOnly) return;
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], low: val },
    }));
  };

  const setClose = (val) => {
    if (isReadOnly) return;
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], close: val },
    }));
  };

  React.useEffect(() => {
    if (initialData) {
      const tf = normalizeTimeframe(initialData.timeframe);
      setTimeframe(tf);
      if (initialData.open !== undefined || initialData.high !== undefined) {
        setTimeframePages(
          createDefaultPointerPages(
            initialData.open !== undefined ? initialData.open : 962.0,
            initialData.high !== undefined ? initialData.high : 1163.0,
            initialData.low !== undefined ? initialData.low : 962.0,
            initialData.close !== undefined ? initialData.close : 1130.6,
            tf
          )
        );
      }
      if (initialData.script) setScriptName(initialData.script);
      if (initialData.title) setSelectedPresetName(initialData.title);
    }
  }, [initialData]);

  // Robust parser for numbers with Western and Indian comma separators
  const parseNumbersFromPastedText = (text) => {
    if (!text || typeof text !== "string") return [];
    const clean = text.replace(/[₹$€£¥"'\(\)]/g, " ").trim();
    const regex = /-?(?:\d{1,2}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
    const matches = clean.match(regex);
    if (!matches) return [];

    return matches
      .map((m) => {
        const numStr = m.replace(/,/g, "").trim();
        const n = parseFloat(numStr);
        return isNaN(n) ? null : Number(n.toFixed(4));
      })
      .filter((n) => n !== null);
  };

  // Multi-column and Single-column Paste Handler (Open, High, Low, Close)
  const handlePaste = (e, field) => {
    if (isReadOnly) return;
    const pasteText = e.clipboardData?.getData("text");
    if (!pasteText) return;

    const numbers = parseNumbersFromPastedText(pasteText);
    if (!numbers || numbers.length === 0) return;

    e.preventDefault();

    if (numbers.length === 1) {
      // Single value pasted into a specific input
      const val = numbers[0];
      if (field === "open") setOpen(val);
      else if (field === "high") setHigh(val);
      else if (field === "low") setLow(val);
      else if (field === "close") setClose(val);
      else if (field) {
        setTimeframePages((prev) => ({
          ...prev,
          [timeframe]: { ...prev[timeframe], [field]: val },
        }));
      }
    } else {
      // Multi-column OHLC paste (open, high, low, close)
      const [pOpen, pHigh, pLow, pClose] = numbers;

      setTimeframePages((prev) => {
        const current = prev[timeframe] || {};
        const next = { ...current };
        if (pOpen !== undefined && !isNaN(pOpen)) next.open = pOpen;
        if (pHigh !== undefined && !isNaN(pHigh)) next.high = pHigh;
        if (pLow !== undefined && !isNaN(pLow)) next.low = pLow;
        if (pClose !== undefined && !isNaN(pClose)) next.close = pClose;
        return { ...prev, [timeframe]: next };
      });
      setCopiedText("Pasted OHLC data into fields!");
      setTimeout(() => setCopiedText(null), 2500);
    }
  };

  const format2Dec = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const num = Number(val);
    if (isNaN(num)) return val;
    return Number(num.toFixed(2));
  };

  // Pointer Type Calculation using Exact Excel Formula
  const pointerType = useMemo(() => {
    const o = parseFloat(open) || 0;
    const h = parseFloat(high) || 0;
    const l = parseFloat(low) || 0;
    let c = parseFloat(close) || 0;

    if (Math.abs(h - c) < 0.0001) {
      c = c - 0.05;
    } else if (Math.abs(l - c) < 0.0001) {
      c = c + 0.05;
    }

    const evalP = (hV, lV, cV) => {
      const r = Math.max(0, hV - lV);
      const rm14 = cV + r * 0.146;
      const rm38 = cV + r * 0.382;
      const rm61 = cV + r * 0.618;
      const rm100 = cV + r * 1.0;
      const fm14 = cV - r * 0.146;
      const fm38 = cV - r * 0.382;
      const fm61 = cV - r * 0.618;
      const fm100 = cV - r * 1.0;

      if (hV > rm61 && hV < rm100 && lV < fm14 && lV > fm38) return "Rising Jack";
      if (hV > rm38 && hV < rm61 && lV < fm38 && lV > fm61) return "Table Tennis";
      if (hV > rm14 && hV < rm38 && lV < fm61 && lV > fm100) return "Table Top";
      if (hV > fm14 && hV < rm14 && lV > fm100 && lV < fm61) return "Upward Rotation";
      if (hV > rm61 && hV < rm100 && lV > fm14 && lV < rm14) return "Falling Duck";
      return "FALSE";
    };

    return evalP(h, l, c);
  }, [open, high, low, close]);

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
    setTimeframe(preset.timeframe);
    setTimeframePages(createDefaultPointerPages(preset.open, preset.high, preset.low, preset.close));
  };

  const handleCopy = (val, label) => {
    if (val === null || val === undefined) return;
    const text = typeof val === "number" ? val.toFixed(2) : String(val);
    navigator.clipboard?.writeText(text);
    setCopiedText(`${label || "Value"}: ${text}`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  const handleDownloadStrategyExcel = async () => {
    try {
      setIsDownloadingExcel(true);
      await screenerService.downloadStrategyExcel({
        symbol: scriptName || "Selected_Stock",
        open,
        high,
        low,
        close,
        average: calcs.average,
        range: calcs.range,
        timeframe,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      alert("Failed to generate strategy spreadsheet: " + (err.message || "Server error"));
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <div className="pointer-page-wrapper">
      {/* BACK BUTTON */}
      {onBack && (
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#1e293b",
              padding: "7px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>←</span> Back to {previousTab === "screener" ? "Screener" : previousTab === "reports" ? "Stock Analytics" : "Previous Page"}
          </button>
        </div>
      )}

      {/* HEADER HERO BAR */}
      <div className="pointer-header-container">
        {/* HORIZONTAL TIMEFRAME TAB SELECTOR */}
        {shouldShowTabSelector && (
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
        )}
      </div>

      {/* IDENTIFIED POINTER TYPE BANNER ABOVE MATRIX CARD */}
      <div className="strategy-pointer-type-banner">
        <div className="pointer-type-title-group">
          <span className="pointer-type-dot"></span>
          <span className="pointer-type-label">Identified Pointer Type:</span>
          <span className={`pointer-type-badge ${pointerType === "FALSE" ? "false-badge" : ""}`}>
            {pointerType}
          </span>
        </div>
        <div className="pointer-type-meta">
          <span className="meta-item">Symbol: <strong className="highlight-val">{stripSymbolSuffix(scriptName)}</strong></span>
          <span className="meta-item">Timeframe: <strong className="highlight-val">{timeframe}</strong></span>
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
        {/* TOP CHANNEL BAR: RISING CHANNEL ONLY */}
        <div className="pointer-horizontal-channel-bar">
          <div className="channel-badge-group">
            <span className="sidebar-rising-badge">RISING CHANNEL</span>
            <span className="sidebar-timeframe-badge">{timeframe}</span>
          </div>
        </div>

        {/* FULL MATRIX */}
        <div className="pointer-compact-matrix full-width">
            
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

            {/* BOTTOM CHANNEL BAR: FALLING CHANNEL (AT THE BOTTOM OF THE MATRIX) */}
            <div className="pointer-horizontal-channel-bar falling-bar" style={{ marginTop: "12px" }}>
              <div className="channel-badge-group">
                <span className="sidebar-falling-badge red">FALLING CHANNEL</span>
                <span className="sidebar-timeframe-badge">{timeframe}</span>
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
              value={format2Dec(open)}
              onChange={(e) => setOpen(e.target.value)}
              onPaste={(e) => handlePaste(e, "open")}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              title={isReadOnly ? "Read-only OPEN value" : "Click to edit OPEN value (or paste OHLC range row)"}
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={format2Dec(high)}
              onChange={(e) => setHigh(e.target.value)}
              onPaste={(e) => handlePaste(e, "high")}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              title={isReadOnly ? "Read-only HIGH value" : "Click to edit HIGH value"}
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={format2Dec(low)}
              onChange={(e) => setLow(e.target.value)}
              onPaste={(e) => handlePaste(e, "low")}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              title={isReadOnly ? "Read-only LOW value" : "Click to edit LOW value"}
            />
          </div>
          <div className="summary-col-val input-wrapper">
            <input
              type="number"
              step="any"
              className="apple-number-input"
              value={format2Dec(close)}
              onChange={(e) => setClose(e.target.value)}
              onPaste={(e) => handlePaste(e, "close")}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              title={isReadOnly ? "Read-only CLOSE value" : "Click to edit CLOSE value"}
            />
          </div>
          <div className="summary-col-val readonly-val" title="Calculated Average (H+L+C)/3">
            {fmt(calcs.average, 2)}
          </div>
          <div className="summary-col-val readonly-val" title="Calculated Range (H-L)">
            {fmt(calcs.range, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}
