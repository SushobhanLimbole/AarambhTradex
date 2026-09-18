import React, { useState, useMemo, useEffect } from "react";
import "./StrategyPage.css";
import strategyCalculationService from "../../services/strategyCalculationService.js";
import strategyAccessService from "../../services/strategyAccessService.js";
import { useAuth } from "../../context/AuthContext.jsx";

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

export default function StrategyPage({ initialData }) {
  const { user } = useAuth();

  // Input states
  const initHigh = initialData?.high ?? 892.20;
  const initLow = initialData?.low ?? 882.60;
  const initClose = initialData?.close ?? 890.80;

  const [open, setOpen] = useState(initialData?.open ?? 886.75);
  const [high, setHigh] = useState(initHigh);
  const [low, setLow] = useState(initLow);
  const [close, setClose] = useState(initClose);
  const [range, setRange] = useState(
    initialData?.range !== undefined ? initialData.range : (initHigh - initLow)
  );
  const [isCustomRange, setIsCustomRange] = useState(initialData?.range !== undefined);
  const [average, setAverage] = useState(
    initialData?.average !== undefined
      ? initialData.average
      : Number(((parseFloat(initHigh) + parseFloat(initLow) + parseFloat(initClose)) / 3).toFixed(2))
  );
  const [isCustomAverage, setIsCustomAverage] = useState(initialData?.average !== undefined);
  const [scriptName, setScriptName] = useState(initialData?.script ?? "Nifty-50");
  const [timeframe, setTimeframe] = useState(initialData?.timeframe ?? "Daily");
  const [copiedText, setCopiedText] = useState(null);
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialData?.title ? "Custom / Selected Stock" : "Master Reference (Nifty-50)"
  );

  // Strategy API data & access state
  const [strategyApiData, setStrategyApiData] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    if (initialData) {
      const hVal = initialData.high !== undefined ? initialData.high : 892.20;
      const lVal = initialData.low !== undefined ? initialData.low : 882.60;
      const cVal = initialData.close !== undefined ? initialData.close : 890.80;

      if (initialData.open !== undefined) setOpen(initialData.open);
      if (initialData.high !== undefined) setHigh(hVal);
      if (initialData.low !== undefined) setLow(lVal);
      if (initialData.close !== undefined) setClose(cVal);

      if (initialData.range !== undefined) {
        setRange(initialData.range);
        setIsCustomRange(true);
      } else {
        setRange(Number((parseFloat(hVal) - parseFloat(lVal)).toFixed(2)));
        setIsCustomRange(false);
      }

      if (initialData.average !== undefined) {
        setAverage(initialData.average);
        setIsCustomAverage(true);
      } else {
        const computedAvg = Number(((parseFloat(hVal) + parseFloat(lVal) + parseFloat(cVal)) / 3).toFixed(2));
        setAverage(computedAvg);
        setIsCustomAverage(false);
      }

      if (initialData.timeframe) setTimeframe(initialData.timeframe);
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
    setOpen(preset.open);
    setHigh(preset.high);
    setLow(preset.low);
    setClose(preset.close);
    if (preset.range !== undefined) {
      setRange(preset.range);
      setIsCustomRange(true);
    } else {
      const calcR = Math.max(0, preset.high - preset.low);
      setRange(calcR);
      setIsCustomRange(false);
    }
    if (preset.average !== undefined) {
      setAverage(preset.average);
      setIsCustomAverage(true);
    } else {
      const calcAvg = ((preset.high + preset.low + preset.close) / 3).toFixed(2);
      setAverage(calcAvg);
      setIsCustomAverage(false);
    }
    setTimeframe(preset.timeframe);
    if (preset.script) setScriptName(preset.script);
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
      <div className="strategy-header-container">
        <div className="strategy-title-area">
          <div className="strategy-badge-pill">
            <span className="strategy-pulsing-dot"></span>
            <span>INSTITUTIONAL STRATEGY &amp; DECISION MATRIX</span>
          </div>
          <h1 className="strategy-heading">Strategy &amp; Fibonacci Decision Engine</h1>
          <p className="strategy-subheading">
            Live institutional trading strategies, breakout pointers, table tennis ranges, and confidential server-calculated Fibonacci targets.
          </p>
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
        <div className="card-section-label">
          <span>PART 1: INSTITUTIONAL POINTER MATRIX</span>
        </div>

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
              <div className="summary-col-header">OPEN</div>
              <div className="summary-col-header">HIGH</div>
              <div className="summary-col-header">LOW</div>
              <div className="summary-col-header">CLOSE</div>
              <div className="summary-col-header">AVERAGE</div>
              <div className="summary-col-header">RANGE</div>

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
        <div className="card-section-label">
          <span>PART 2: STRATEGY DECISION MATRIX &amp; POINTER SCENARIOS (API CALCULATED)</span>
          {strategyLoading && <span className="strategy-api-badge loading">Syncing with Server API...</span>}
          {strategyApiData && !strategyLoading && <span className="strategy-api-badge live">✓ Live API Synced</span>}
        </div>

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
            {/* TOP SPLIT: CONDITIONS & SIGNAL MATRIX */}
            <div className="strategy-top-split-grid">
              
              {/* LEFT: SCRIPT CONDITIONS & TABLE TOP SCENARIOS */}
              <div className="strategy-condition-panel">
                {/* SCRIPT SELECTOR */}
                <div className="script-header-row">
                  <div className="script-title-cell">Script</div>
                  <div className="script-value-cell">{scriptName}</div>
                </div>

                {/* CONDITIONS TABLE (DYNAMICALLY FROM API) */}
                <div className="conditions-table">
                  <div className="condition-row">
                    <div className="cond-tag purple">High</div>
                    <div className="cond-desc">{strategyApiData?.conditions?.high || "Above FC 14.6 & Below RC 14.6."}</div>
                  </div>
                  <div className="condition-row">
                    <div className="cond-tag sage">Low</div>
                    <div className="cond-desc">{strategyApiData?.conditions?.low || "Above FC 100 & Below FC 61.8."}</div>
                  </div>
                  <div className="condition-row">
                    <div className="cond-tag sage">Low</div>
                    <div className="cond-desc status-false">{strategyApiData?.conditions?.lowCheck2 || "FALSE"}</div>
                  </div>
                  <div className="condition-row">
                    <div className="cond-tag coral">Close</div>
                    <div className="cond-desc">{strategyApiData?.conditions?.close || "Above FC 14.6 & Below RC 14.6."}</div>
                  </div>

                  {/* SCENARIO BANNER */}
                  <div className="scenario-banner-row">
                    <div className="scenario-label">Scenario</div>
                    <div className="scenario-value">{strategyApiData?.conditions?.scenario || "UPWARD ROTATION"}</div>
                  </div>

                  {/* SECONDARY CHECKS */}
                  <div className="condition-row">
                    <div className="cond-tag deep-purple">High &amp; Low</div>
                    <div className="cond-desc">{strategyApiData?.conditions?.highLow || "Above FC 38.2 & Below FC 23.6."}</div>
                  </div>
                  <div className="condition-row">
                    <div className="cond-tag teal">Low &amp; Close</div>
                    <div className="cond-desc">{strategyApiData?.conditions?.lowClose || "Above FC 14.6 & Below RC 14.6."}</div>
                  </div>
                </div>
              </div>

              {/* RIGHT: YELLOW / GREEN / RED SIGNAL MATRIX (FROM API TRIGGERS MATCHING EXCEL) */}
              <div className="strategy-signal-matrix-panel">
                <div className="signal-matrix-header">
                  <div className="sig-col-head yellow">YELLOW</div>
                  <div className="sig-col-head green">GREEN</div>
                  <div className="sig-col-head red">RED</div>
                </div>

                <div className="signal-matrix-grid">
                  {/* Row 1: Y1 (893.16), G1 (889.22), R5 (880.80) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y1 ?? 893.16, "Y1 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y1 ?? 893.16)}
                  </div>
                  <div className="sig-cell green-val" onClick={() => handleCopy(apiTriggers?.green?.G1 ?? 889.22, "G1 Trigger")}>
                    {fmt(apiTriggers?.green?.G1 ?? 889.22)}
                  </div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[0] ?? apiTriggers?.red?.R5 ?? 880.80, "R5 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[0] ?? apiTriggers?.red?.R5 ?? 880.80)}
                  </div>

                  {/* Row 2: Y2 (894.62), G2 (890.80 - Boxed Close), R4 (883.78) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y2 ?? 894.62, "Y2 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y2 ?? 894.62)}
                  </div>
                  <div className="sig-cell green-val highlight-box" onClick={() => handleCopy(apiTriggers?.green?.G2 ?? close ?? 890.80, "G2 Close Reference")} title="Current Close Price Level (G2)">
                    {fmt(apiTriggers?.green?.G2 ?? close ?? 890.80)}
                  </div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[1] ?? apiTriggers?.red?.R4 ?? 883.78, "R4 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[1] ?? apiTriggers?.red?.R4 ?? 883.78)}
                  </div>

                  {/* Row 3: Y3 (896.32), G3 (892.38), R1 (885.28) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y3 ?? 896.32, "Y3 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y3 ?? 896.32)}
                  </div>
                  <div className="sig-cell green-val" onClick={() => handleCopy(apiTriggers?.green?.G3 ?? 892.38, "G3 Trigger")}>
                    {fmt(apiTriggers?.green?.G3 ?? 892.38)}
                  </div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[2] ?? apiTriggers?.red?.R1 ?? 885.28, "R1 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[2] ?? apiTriggers?.red?.R1 ?? 885.28)}
                  </div>

                  {/* Row 4: Y4 (897.82), G4 (empty), R2 (886.98) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y4 ?? 897.82, "Y4 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y4 ?? 897.82)}
                  </div>
                  <div className="sig-cell empty-val"></div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[3] ?? apiTriggers?.red?.R2 ?? 886.98, "R2 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[3] ?? apiTriggers?.red?.R2 ?? 886.98)}
                  </div>

                  {/* Row 5: Y5 (900.80), G5 (empty), R3 (888.44) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y5 ?? 900.80, "Y5 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y5 ?? 900.80)}
                  </div>
                  <div className="sig-cell empty-val"></div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[4] ?? apiTriggers?.red?.R3 ?? 888.44, "R3 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[4] ?? apiTriggers?.red?.R3 ?? 888.44)}
                  </div>

                  {/* Row 6: Y6 (906.98), G6 (empty), R6 (874.62) */}
                  <div className="sig-cell yellow-val" onClick={() => handleCopy(apiTriggers?.yellow?.Y6 ?? 906.98, "Y6 Trigger")}>
                    {fmt(apiTriggers?.yellow?.Y6 ?? 906.98)}
                  </div>
                  <div className="sig-cell empty-val"></div>
                  <div className="sig-cell red-val" onClick={() => handleCopy(apiTriggers?.displayTable?.red?.[5] ?? apiTriggers?.red?.R6 ?? 874.62, "R6 Trigger")}>
                    {fmt(apiTriggers?.displayTable?.red?.[5] ?? apiTriggers?.red?.R6 ?? 874.62)}
                  </div>
                </div>
              </div>

            </div>

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
