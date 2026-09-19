import React, { useState, useMemo, useEffect } from "react";
import "./StrategyPage.css";
import strategyCalculationService from "../../services/strategyCalculationService.js";
import strategyAccessService from "../../services/strategyAccessService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

// 9 Fibonacci Ratio Columns
const FIB_COLUMNS = [14.6, 23.6, 38.2, 61.8, 100, 127.2, 161.8, 261.8, 423.6];

// Preset Scenarios
const PRESETS = [
  {
    name: "Master Reference (Nifty-50)",
    script: "Nifty-50",
    open: 886.75,
    high: 892.20,
    low: 882.60,
    close: 890.80,
    range: 10.00,
    average: 888.53,
    timeframe: "Daily",
  },
  {
    name: "NIFTY 50 (Live Index)",
    script: "NIFTY-50",
    open: 24780.0,
    high: 25150.0,
    low: 24690.0,
    close: 25080.5,
    range: 460.0,
    average: 24973.50,
    timeframe: "Daily",
  },
  {
    name: "BANK NIFTY (Index)",
    script: "BANKNIFTY",
    open: 51200.0,
    high: 51980.0,
    low: 50950.0,
    close: 51760.0,
    range: 1030.0,
    average: 51563.33,
    timeframe: "Daily",
  },
  {
    name: "RELIANCE IND.",
    script: "RELIANCE",
    open: 2980.5,
    high: 3025.0,
    low: 2972.1,
    close: 3018.4,
    range: 52.9,
    average: 3005.17,
    timeframe: "Daily",
  },
  {
    name: "TATA MOTORS",
    script: "TATAMOTORS",
    open: 1045.0,
    high: 1092.5,
    low: 1038.0,
    close: 1084.2,
    range: 54.5,
    average: 1071.57,
    timeframe: "Daily",
  },
  {
    name: "HDFC BANK",
    script: "HDFCBANK",
    open: 1620.0,
    high: 1665.0,
    low: 1615.0,
    close: 1658.0,
    range: 50.0,
    average: 1646.00,
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

const createDefaultStrategyPages = (
  baseOpen = 886.75,
  baseHigh = 892.20,
  baseLow = 882.60,
  baseClose = 890.80,
  customRange,
  customAverage,
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
      const h = Number(baseHigh);
      const l = Number(baseLow);
      const o = Number(baseOpen);
      const c = Number(baseClose);
      const r = customRange !== undefined ? Number(customRange) : Number((h - l).toFixed(2));
      const avg = customAverage !== undefined ? Number(customAverage) : Number(((h + l + c) / 3).toFixed(2));
      pages[tf] = {
        open: o,
        high: h,
        low: l,
        close: c,
        range: r,
        isCustomRange: customRange !== undefined,
        average: avg,
        isCustomAverage: customAverage !== undefined,
      };
    } else {
      const mult = (multipliers[tf] || 1.0) / baseMult;
      const mid = (baseHigh + baseLow) / 2;
      const halfR = ((baseHigh - baseLow) * mult) / 2;
      const h = Number((mid + halfR).toFixed(2));
      const l = Number(Math.max(1, mid - halfR).toFixed(2));
      const o = Number(baseOpen.toFixed(2));
      const c = Number(baseClose.toFixed(2));
      const r = Number((h - l).toFixed(2));
      const avg = Number(((h + l + c) / 3).toFixed(2));
      pages[tf] = {
        open: o,
        high: h,
        low: l,
        close: c,
        range: r,
        isCustomRange: false,
        average: avg,
        isCustomAverage: false,
      };
    }
  });
  return pages;
};

export default function StrategyPage({ initialData, onBack, previousTab = "screener" }) {
  const { user } = useAuth();

  const [scriptName, setScriptName] = useState(initialData?.script ?? "Nifty-50");
  const [timeframe, setTimeframe] = useState(normalizeTimeframe(initialData?.timeframe ?? "Daily"));
  const [copiedText, setCopiedText] = useState(null);
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialData?.title ? "Custom / Selected Stock" : "Master Reference (Nifty-50)"
  );

  // 7-Page Independent State System
  const [timeframePages, setTimeframePages] = useState(() => {
    const initTf = normalizeTimeframe(initialData?.timeframe ?? "Daily");
    return createDefaultStrategyPages(
      initialData?.open ?? 886.75,
      initialData?.high ?? 892.20,
      initialData?.low ?? 882.60,
      initialData?.close ?? 890.80,
      initialData?.range,
      initialData?.average,
      initTf
    );
  });

  // Current active timeframe values
  const currentData = timeframePages[timeframe] || {
    open: 886.75,
    high: 892.20,
    low: 882.60,
    close: 890.80,
    range: 9.60,
    average: 888.53,
    isCustomRange: false,
    isCustomAverage: false,
  };

  const open = currentData.open;
  const high = currentData.high;
  const low = currentData.low;
  const close = currentData.close;
  const range = currentData.range;
  const average = currentData.average;
  const isCustomRange = currentData.isCustomRange;
  const isCustomAverage = currentData.isCustomAverage;

  const setOpen = (val) => {
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], open: val },
    }));
  };

  const setHigh = (val) => {
    setTimeframePages((prev) => {
      const current = prev[timeframe] || {};
      const l = parseFloat(current.low) || 0;
      const c = parseFloat(current.close) || 0;
      const h = parseFloat(val) || 0;
      const next = { ...current, high: val };
      if (!current.isCustomRange) {
        next.range = Number(Math.max(0, h - l).toFixed(2));
      }
      if (!current.isCustomAverage) {
        next.average = Number(((h + l + c) / 3).toFixed(2));
      }
      return { ...prev, [timeframe]: next };
    });
  };

  const setLow = (val) => {
    setTimeframePages((prev) => {
      const current = prev[timeframe] || {};
      const h = parseFloat(current.high) || 0;
      const c = parseFloat(current.close) || 0;
      const l = parseFloat(val) || 0;
      const next = { ...current, low: val };
      if (!current.isCustomRange) {
        next.range = Number(Math.max(0, h - l).toFixed(2));
      }
      if (!current.isCustomAverage) {
        next.average = Number(((h + l + c) / 3).toFixed(2));
      }
      return { ...prev, [timeframe]: next };
    });
  };

  const setClose = (val) => {
    setTimeframePages((prev) => {
      const current = prev[timeframe] || {};
      const h = parseFloat(current.high) || 0;
      const l = parseFloat(current.low) || 0;
      const c = parseFloat(val) || 0;
      const next = { ...current, close: val };
      if (!current.isCustomAverage) {
        next.average = Number(((h + l + c) / 3).toFixed(2));
      }
      return { ...prev, [timeframe]: next };
    });
  };

  const setRange = (val) => {
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], range: val, isCustomRange: true },
    }));
  };

  const setAverage = (val) => {
    setTimeframePages((prev) => ({
      ...prev,
      [timeframe]: { ...prev[timeframe], average: val, isCustomAverage: true },
    }));
  };

  // Strategy API data & access state
  const [strategyApiData, setStrategyApiData] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    if (initialData) {
      const tf = normalizeTimeframe(initialData.timeframe);
      setTimeframe(tf);
      if (initialData.open !== undefined || initialData.high !== undefined) {
        const hVal = initialData.high !== undefined ? initialData.high : 892.20;
        const lVal = initialData.low !== undefined ? initialData.low : 882.60;
        const cVal = initialData.close !== undefined ? initialData.close : 890.80;
        const oVal = initialData.open !== undefined ? initialData.open : 886.75;
        const rVal = initialData.range !== undefined ? initialData.range : Number((parseFloat(hVal) - parseFloat(lVal)).toFixed(2));
        const aVal = initialData.average !== undefined ? initialData.average : Number(((parseFloat(hVal) + parseFloat(lVal) + parseFloat(cVal)) / 3).toFixed(2));

        setTimeframePages(
          createDefaultStrategyPages(
            oVal,
            hVal,
            lVal,
            cVal,
            initialData.range !== undefined ? rVal : undefined,
            initialData.average !== undefined ? aVal : undefined,
            tf
          )
        );
      }

      if (initialData.script) setScriptName(initialData.script);
      if (initialData.title) setSelectedPresetName(initialData.title);
    }
  }, [initialData]);

  // Fetch confidential calculation data from backend API
  useEffect(() => {
    let isCancelled = false;
    async function fetchStrategy() {
      setStrategyLoading(true);
      setAccessDenied(false);
      try {
        const res = await strategyCalculationService.calculateStrategy({
          open: parseFloat(open) || 0,
          high: parseFloat(high) || 0,
          low: parseFloat(low) || 0,
          close: parseFloat(close) || 0,
          range: (range !== undefined && range !== null && !isNaN(parseFloat(range))) ? parseFloat(range) : undefined,
          average: (average !== undefined && average !== null && !isNaN(parseFloat(average))) ? parseFloat(average) : undefined,
          symbol: scriptName,
          timeframe,
        });

        if (!isCancelled && res) {
          setStrategyApiData(res);
          setAccessDenied(false);
        }
      } catch (err) {
        if (!isCancelled) {
          if (err.statusCode === 403 || err.status === 403) {
            setAccessDenied(true);
            setAccessMessage(err.message || "Institutional strategy decision formulas are restricted to approved accounts.");
          } else {
            console.warn("Strategy API notice:", err.message);
          }
        }
      } finally {
        if (!isCancelled) setStrategyLoading(false);
      }
    }

    fetchStrategy();

    return () => {
      isCancelled = true;
    };
  }, [open, high, low, close, range, average, scriptName, timeframe]);

  // Request Access Handler
  const handleRequestAccess = async () => {
    try {
      await strategyAccessService.requestAccess();
      setRequestSent(true);
      setCopiedText("Strategy access request submitted to admin!");
      setTimeout(() => setCopiedText(null), 3000);
    } catch (err) {
      setCopiedText(err.message || "Failed to submit access request");
      setTimeout(() => setCopiedText(null), 3000);
    }
  };

  // Formatting helper
  const fmt = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return "—";
    return Number(num).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Calculations for Matrix Display
  const calcs = useMemo(() => {
    const o = parseFloat(open) || 0;
    const h = parseFloat(high) || 0;
    const l = parseFloat(low) || 0;
    const c = parseFloat(close) || 0;

    // Range: (HIGH - LOW), or user-modified custom range
    const r = (range !== undefined && range !== null && !isNaN(parseFloat(range)) && parseFloat(range) > 0)
      ? parseFloat(range)
      : Math.max(0, h - l);

    // Average: (HIGH + LOW + CLOSE) / 3 (OPEN strictly not considered), or user-modified custom average
    const avgVal = (average !== undefined && average !== null && !isNaN(parseFloat(average)) && parseFloat(average) > 0)
      ? parseFloat(average)
      : ((h + l + c) / 3);

    const highLow = (h + l) / 2;
    const lowClose = (l + c) / 2;
    const highClose = (h + c) / 2;

    // Rising Channel computations
    const risingMain = {
      14.6: c + r * 0.146,
      23.6: c + r * 0.236,
      38.2: c + r * 0.382,
      61.8: c + r * 0.618,
      100: c + r * 1.0,
      127.2: c + r * 1.272,
      161.8: c + r * 1.618,
      261.8: c + r * 2.618,
      423.6: c + r * 4.236,
    };

    const risingUpper = {
      14.6: c + r * 0.1804,
      23.6: risingMain[23.6],
      38.2: c + r * 0.4721,
      61.8: risingMain[61.8] + r * 0.146,
      100: risingMain[100] + r * 0.1039,
      127.2: risingMain[127.2] + r * 0.1322,
      161.8: risingMain[161.8] + r * 0.382,
      261.8: risingMain[261.8] + r * 0.618,
      423.6: null,
    };

    const risingLower = {
      14.6: c + r * 0.0345,
      23.6: risingMain[23.6],
      38.2: c + r * 0.3262,
      61.8: risingMain[61.8] - r * 0.0901,
      100: risingMain[100] - r * 0.146,
      127.2: risingMain[127.2] - r * 0.1039,
      161.8: risingMain[161.8] - r * 0.1322,
      261.8: risingMain[261.8] - r * 0.382,
      423.6: null,
    };

    // Falling Channel computations
    const fallingMain = {
      14.6: c - r * 0.146,
      23.6: c - r * 0.236,
      38.2: c - r * 0.382,
      61.8: c - r * 0.618,
      100: c - r * 1.0,
      127.2: c - r * 1.272,
      161.8: c - r * 1.618,
      261.8: c - r * 2.618,
      423.6: c - r * 4.236,
    };

    const fallingUpper = {
      14.6: c - r * 0.0345,
      23.6: fallingMain[23.6],
      38.2: c - r * 0.3262,
      61.8: fallingMain[61.8] + r * 0.0901,
      100: fallingMain[100] + r * 0.146,
      127.2: fallingMain[127.2] + r * 0.1039,
      161.8: fallingMain[161.8] + r * 0.1322,
      261.8: fallingMain[261.8] + r * 0.382,
      423.6: null,
    };

    const fallingLower = {
      14.6: c - r * 0.1804,
      23.6: fallingMain[23.6],
      38.2: c - r * 0.4721,
      61.8: fallingMain[61.8] - r * 0.146,
      100: fallingMain[100] - r * 0.1039,
      127.2: fallingMain[127.2] - r * 0.1322,
      161.8: fallingMain[161.8] - r * 0.382,
      261.8: fallingMain[261.8] - r * 0.618,
      423.6: null,
    };

    return {
      range: r,
      average: avgVal,
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
  }, [open, high, low, close, range, average]);

  const loadPreset = (preset) => {
    setSelectedPresetName(preset.name);
    setTimeframe(preset.timeframe);
    if (preset.script) setScriptName(preset.script);
    setTimeframePages(
      createDefaultStrategyPages(
        preset.open,
        preset.high,
        preset.low,
        preset.close,
        preset.range,
        preset.average
      )
    );
  };

  const handleCopy = (val, label) => {
    if (val === null || val === undefined) return;
    const text = typeof val === "number" ? val.toFixed(2) : String(val);
    navigator.clipboard?.writeText(text);
    setCopiedText(`${label || "Value"}: ${text}`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Extract triggers and scenarios from API response
  const apiTriggers = strategyApiData?.triggers;
  const apiScenarios = strategyApiData?.scenarios || [];

  return (
    <div className="strategy-page-wrapper">
      {/* HEADER HERO BAR */}
      {onBack && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={onBack}
            type="button"
            className="strategy-back-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "8px 16px",
              fontSize: "13.5px",
              fontWeight: "600",
              color: "#1e293b",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            <span style={{ fontSize: 16 }}>←</span> Back to {previousTab === "screener" ? "Screener" : previousTab === "reports" ? "Stock Analytics" : "Previous Page"}
          </button>
        </div>
      )}

      {/* HORIZONTAL TIMEFRAME TAB SELECTOR */}
      <div className="pointer-timeframe-tab-bar" style={{ marginBottom: 14 }}>
        {TIMEFRAMES.map((tf) => (
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

      {/* IDENTIFIED POINTER TYPE BANNER ABOVE MATRIX CARD */}
      <div className="strategy-pointer-type-banner">
        <div className="pointer-type-title-group">
          <span className="pointer-type-dot"></span>
          <span className="pointer-type-label">Identified Pointer Type:</span>
          <span className={`pointer-type-badge ${strategyApiData?.conditions?.scenario === "FALSE" ? "false-badge" : ""}`}>
            {strategyApiData?.conditions?.scenario || "FALSE"}
          </span>
        </div>
        <div className="pointer-type-meta">
          <span className="meta-item">Symbol: <strong className="highlight-val">{stripSymbolSuffix(scriptName)}</strong></span>
          <span className="meta-item">Timeframe: <strong className="highlight-val">{timeframe}</strong></span>
          <span className="meta-item">Channel: <strong className="highlight-val">{strategyApiData?.conditions?.channel || "RISING"}</strong></span>
        </div>
      </div>

      {/* COPIED TOAST */}
      {copiedText && (
        <div className="strategy-toast">
          <span className="toast-icon">✓</span>
          <span>{copiedText}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: FULL POINTER MATRIX CARD                       */}
      {/* ========================================================= */}
      <div className="strategy-card pointer-matrix-block">
        {/* <div className="card-section-label">
          <span>PART 1: INSTITUTIONAL POINTER MATRIX</span>
        </div> */}

        <div className="pointer-compact-layout">
          {/* LEFT SIDEBAR */}
          <div className="pointer-compact-sidebar">
            <div className="sidebar-top-badges">
              <span className="sidebar-rising-badge">RISING CHANNEL</span>
              <span className="sidebar-timeframe-badge">{timeframe}</span>
            </div>

            <div className="sidebar-blue-accent-strip"></div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">HIGH &amp; LOW</span>
              <span className="metric-value">{fmt(calcs.highLow)}</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">LOW &amp; CLOSE</span>
              <span className="metric-value">{fmt(calcs.lowClose)}</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">HIGH &amp; CLOSE</span>
              <span className="metric-value">{fmt(calcs.highClose)}</span>
            </div>

            <div className="sidebar-blue-divider"></div>

            <div className="sidebar-metric-card highlight-close">
              <span className="metric-label yellow-bg">Close Price</span>
              <span className="metric-value">{fmt(close)}</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">DAILY Range</span>
              <span className="metric-value">{fmt(calcs.range)}</span>
            </div>

            <div className="sidebar-blue-divider"></div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">HIGH</span>
              <span className="metric-value">{fmt(high)}</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">LOW</span>
              <span className="metric-value">{fmt(low)}</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">Close</span>
              <span className="metric-value">{fmt(close)}</span>
            </div>

            <div className="sidebar-metric-card single-tag">
              <span className="metric-label yellow-bg full-width">FALLING CHANNEL</span>
            </div>

            <div className="sidebar-metric-card">
              <span className="metric-label yellow-bg">Average</span>
              <span className="metric-value">{fmt(calcs.average)}</span>
            </div>

            <div className="sidebar-blue-divider"></div>

            <div className="sidebar-falling-badge cyan">FALLING CHANNEL</div>
            <div className="sidebar-falling-badge red">FALLING CHANNEL</div>
          </div>

          {/* VERTICAL DIVIDER */}
          <div className="pointer-vertical-accent-divider"></div>

          {/* RIGHT MATRIX */}
          <div className="pointer-compact-matrix">
            <div className="fib-header-row top-header">
              {FIB_COLUMNS.map((fib) => (
                <div key={`top-${fib}`} className="fib-header-cell">
                  {fib}
                </div>
              ))}
            </div>

            <div className="matrix-staircase-body">
              {/* RISING CHANNEL */}
              <div className="channel-staircase-section rising">
                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[127.2])}>{fmt(calcs.risingUpper[127.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[161.8])}>{fmt(calcs.risingUpper[161.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[261.8])}>{fmt(calcs.risingUpper[261.8])}</div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[127.2])}>{fmt(calcs.risingMain[127.2])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[161.8])}>{fmt(calcs.risingMain[161.8])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[261.8])}>{fmt(calcs.risingMain[261.8])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[423.6])}>{fmt(calcs.risingMain[423.6])}</div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[61.8])}>{fmt(calcs.risingUpper[61.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[100])}>{fmt(calcs.risingUpper[100])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[127.2])}>{fmt(calcs.risingLower[127.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[161.8])}>{fmt(calcs.risingLower[161.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[261.8])}>{fmt(calcs.risingLower[261.8])}</div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[61.8])}>{fmt(calcs.risingMain[61.8])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[100])}>{fmt(calcs.risingMain[100])}</div>
                  <div className="stair-offset offset-4"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[14.6])}>{fmt(calcs.risingUpper[14.6])}</div>
                  <div className="stair-cell yellow-highlight-cell" onClick={() => handleCopy(calcs.risingUpper[23.6])}>{fmt(calcs.risingUpper[23.6])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingUpper[38.2])}>{fmt(calcs.risingUpper[38.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[61.8])}>{fmt(calcs.risingLower[61.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[100])}>{fmt(calcs.risingLower[100])}</div>
                  <div className="stair-offset offset-4"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[14.6])}>{fmt(calcs.risingMain[14.6])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[23.6])}>{fmt(calcs.risingMain[23.6])}</div>
                  <div className="stair-cell green-cell" onClick={() => handleCopy(calcs.risingMain[38.2])}>{fmt(calcs.risingMain[38.2])}</div>
                  <div className="stair-offset offset-6"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[14.6])}>{fmt(calcs.risingLower[14.6])}</div>
                  <div className="stair-cell yellow-highlight-cell" onClick={() => handleCopy(calcs.risingLower[23.6])}>{fmt(calcs.risingLower[23.6])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[38.2])}>{fmt(calcs.risingLower[38.2])}</div>
                  <div className="stair-offset offset-6"></div>
                </div>
              </div>

              {/* MASTER HORIZONTAL DIVIDER WITH CLOSE PRICE */}
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

              {/* FALLING CHANNEL */}
              <div className="channel-staircase-section falling">
                <div className="stair-row">
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[14.6])}>{fmt(calcs.fallingUpper[14.6])}</div>
                  <div className="stair-cell yellow-highlight-cell" onClick={() => handleCopy(calcs.fallingUpper[23.6])}>{fmt(calcs.fallingUpper[23.6])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[38.2])}>{fmt(calcs.fallingUpper[38.2])}</div>
                  <div className="stair-offset offset-6"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[14.6])}>{fmt(calcs.fallingMain[14.6])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[23.6])}>{fmt(calcs.fallingMain[23.6])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[38.2])}>{fmt(calcs.fallingMain[38.2])}</div>
                  <div className="stair-offset offset-6"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[14.6])}>{fmt(calcs.fallingLower[14.6])}</div>
                  <div className="stair-cell yellow-highlight-cell" onClick={() => handleCopy(calcs.fallingLower[23.6])}>{fmt(calcs.fallingLower[23.6])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[38.2])}>{fmt(calcs.fallingLower[38.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[61.8])}>{fmt(calcs.fallingUpper[61.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[100])}>{fmt(calcs.fallingUpper[100])}</div>
                  <div className="stair-offset offset-4"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[61.8])}>{fmt(calcs.fallingMain[61.8])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[100])}>{fmt(calcs.fallingMain[100])}</div>
                  <div className="stair-offset offset-4"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[61.8])}>{fmt(calcs.fallingLower[61.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[100])}>{fmt(calcs.fallingLower[100])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[127.2])}>{fmt(calcs.fallingUpper[127.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[161.8])}>{fmt(calcs.fallingUpper[161.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingUpper[261.8])}>{fmt(calcs.fallingUpper[261.8])}</div>
                  <div className="stair-cell empty-cell"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[127.2])}>{fmt(calcs.fallingMain[127.2])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[161.8])}>{fmt(calcs.fallingMain[161.8])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[261.8])}>{fmt(calcs.fallingMain[261.8])}</div>
                  <div className="stair-cell red-cell" onClick={() => handleCopy(calcs.fallingMain[423.6])}>{fmt(calcs.fallingMain[423.6])}</div>
                </div>

                <div className="stair-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[127.2])}>{fmt(calcs.fallingLower[127.2])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[161.8])}>{fmt(calcs.fallingLower[161.8])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.fallingLower[261.8])}>{fmt(calcs.fallingLower[261.8])}</div>
                  <div className="stair-cell empty-cell"></div>
                </div>
              </div>
            </div>

            <div className="fib-header-row bottom-header">
              {FIB_COLUMNS.map((fib) => (
                <div key={`bottom-${fib}`} className="fib-header-cell">
                  {fib}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* OHLC INPUT BAR */}
        <div className="strategy-ohlc-inputs-wrapper">
          <div className="pointer-summary-section">
            <div className="summary-header-card">
              <div className="summary-col-header blue-head">OPEN</div>
              <div className="summary-col-header yellow-head">HIGH</div>
              <div className="summary-col-header yellow-head">LOW</div>
              <div className="summary-col-header yellow-head">CLOSE</div>
              <div className="summary-col-header yellow-head">AVERAGE</div>
              <div className="summary-col-header yellow-head">RANGE</div>

              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={open}
                  onChange={(e) => setOpen(e.target.value)}
                />
              </div>
              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={high}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHigh(val);
                    if (!isCustomRange) {
                      setRange(Math.max(0, (parseFloat(val) || 0) - (parseFloat(low) || 0)));
                    }
                    if (!isCustomAverage) {
                      setAverage((((parseFloat(val) || 0) + (parseFloat(low) || 0) + (parseFloat(close) || 0)) / 3).toFixed(2));
                    }
                  }}
                />
              </div>
              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={low}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLow(val);
                    if (!isCustomRange) {
                      setRange(Math.max(0, (parseFloat(high) || 0) - (parseFloat(val) || 0)));
                    }
                    if (!isCustomAverage) {
                      setAverage((((parseFloat(high) || 0) + (parseFloat(val) || 0) + (parseFloat(close) || 0)) / 3).toFixed(2));
                    }
                  }}
                />
              </div>
              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={close}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClose(val);
                    if (!isCustomAverage) {
                      setAverage((((parseFloat(high) || 0) + (parseFloat(low) || 0) + (parseFloat(val) || 0)) / 3).toFixed(2));
                    }
                  }}
                />
              </div>
              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={average}
                  onChange={(e) => {
                    setAverage(e.target.value);
                    setIsCustomAverage(true);
                  }}
                  title="Average (High + Low + Close) / 3 (Editable - Open not considered)"
                />
              </div>
              <div className="summary-col-val">
                <input
                  type="number"
                  step="any"
                  className="apple-number-input"
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value);
                    setIsCustomRange(true);
                  }}
                  title="Fibonacci Channel Range (Editable)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: INSTITUTIONAL STRATEGY & DECISION MATRIX ENGINE */}
      {/* ========================================================= */}
      <div className="strategy-card strategy-engine-block">
        {/* <div className="card-section-label">
          <span>PART 2: STRATEGY DECISION MATRIX &amp; POINTER SCENARIOS (API CALCULATED)</span>
          {strategyLoading && <span className="strategy-api-badge loading">Syncing with Server API...</span>}
          {strategyApiData && !strategyLoading && <span className="strategy-api-badge live">✓ Live API Synced</span>}
        </div> */}

        {/* ACCESS RESTRICTION BARRIER */}
        {accessDenied ? (
          <div className="strategy-access-restricted-card">
            <div className="restricted-icon">🔒</div>
            <h3 className="restricted-title">Institutional Strategy Engine Restricted</h3>
            <p className="restricted-desc">
              {accessMessage || "Confidential mathematical formulas and strategy decision scenarios are exclusively accessible to approved admin and premium members."}
            </p>
            <div className="restricted-actions">
              {requestSent ? (
                <span className="request-sent-pill">✓ Access Request Submitted (Pending Admin Review)</span>
              ) : (
                <button
                  type="button"
                  className="request-access-btn"
                  onClick={handleRequestAccess}
                >
                  Request Strategy Access →
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
           

            {/* ========================================================= */}
            {/* BOTTOM: 5 INSTITUTIONAL STRATEGY DECISION CARDS           */}
            {/* ========================================================= */}
            <div className="strategy-decision-cards-container">
              {apiScenarios.length > 0 ? (
                apiScenarios.map((scen) => (
                  <div key={scen.id} className="strategy-pointer-card">
                    {/* Left 3-Tier Price Stack */}
                    <div className="strat-price-stack">
                      <div
                        className="price-pill yellow"
                        onClick={() => handleCopy(scen.yellow.value, `${scen.name} Yellow (${scen.yellow.code})`)}
                        title={`${scen.yellow.code} Level: ${scen.yellow.channel}`}
                      >
                        {fmt(scen.yellow.value)}
                      </div>
                      <div
                        className="price-pill red"
                        onClick={() => handleCopy(scen.red.value, `${scen.name} Red (${scen.red.code})`)}
                        title={`${scen.red.code} Level: ${scen.red.channel}`}
                      >
                        {fmt(scen.red.value)}
                      </div>
                      <div
                        className="price-pill green"
                        onClick={() => handleCopy(scen.green.value, `${scen.name} Green (${scen.green.code})`)}
                        title={`${scen.green.code} Level: ${scen.green.channel}`}
                      >
                        {fmt(scen.green.value)}
                      </div>
                    </div>

                    {/* Center Decision Banner */}
                    <div className={`strat-center-banner ${scen.theme}-banner ${scen.isMultiline ? "multiline" : ""}`}>
                      {scen.isMultiline ? (
                        <>
                          <span className="banner-line">
                            {scen.name.split("BREAKOUT")[0]}<strong>BREAKOUT</strong>
                          </span>
                          {scen.subtitle && (
                            <span className="banner-line">
                              {scen.subtitle.split("BREAKDOWN")[0]}<strong>BREAKDOWN</strong>
                            </span>
                          )}
                          {scen.bottomLabel && <span className="banner-line sub">{scen.bottomLabel}</span>}
                        </>
                      ) : (
                        <span className="banner-text">{scen.name}</span>
                      )}
                    </div>

                    {/* Right Signal Code Stack */}
                    <div className="strat-code-stack">
                      <div className="code-row">
                        <span className="code-badge yellow">{scen.yellow.code}</span>
                        <span className="channel-badge yellow">{scen.yellow.channel}</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge red">{scen.red.code}</span>
                        <span className="channel-badge red">{scen.red.channel}</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge green">{scen.green.code}</span>
                        <span className="channel-badge green">{scen.green.channel}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* Static fallback cards if loading */
                <>
                  <div className="strategy-pointer-card">
                    <div className="strat-price-stack">
                      <div className="price-pill yellow" onClick={() => handleCopy(1178.05)}>1178.05</div>
                      <div className="price-pill red" onClick={() => handleCopy(1019.66)}>1019.66</div>
                      <div className="price-pill green" onClick={() => handleCopy(1098.85)}>1098.85</div>
                    </div>
                    <div className="strat-center-banner green-banner">
                      <span className="banner-text">SELLING POINTER</span>
                    </div>
                    <div className="strat-code-stack">
                      <div className="code-row">
                        <span className="code-badge yellow">Y1</span>
                        <span className="channel-badge yellow">RC 23.6</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge red">R1</span>
                        <span className="channel-badge red">FC 61.8</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge green">G1</span>
                        <span className="channel-badge green">FC 14.6</span>
                      </div>
                    </div>
                  </div>

                  <div className="strategy-pointer-card">
                    <div className="strat-price-stack">
                      <div className="price-pill yellow" onClick={() => handleCopy(1207.37)}>1207.37</div>
                      <div className="price-pill red" onClick={() => handleCopy(1053.83)}>1053.83</div>
                      <div className="price-pill green" onClick={() => handleCopy(1130.60)}>1130.60</div>
                    </div>
                    <div className="strat-center-banner blue-banner">
                      <span className="banner-text">TABLE TENNIS</span>
                    </div>
                    <div className="strat-code-stack">
                      <div className="code-row">
                        <span className="code-badge yellow">Y2</span>
                        <span className="channel-badge yellow">RC 38.2</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge red">R2</span>
                        <span className="channel-badge red">FC 38.2</span>
                      </div>
                      <div className="code-row">
                        <span className="code-badge green">G2</span>
                        <span className="channel-badge green">CLOSE</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
