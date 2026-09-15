import React, { useState, useMemo } from "react";
import "./StrategyPage.css";

// 9 Fibonacci Ratio Columns
const FIB_COLUMNS = [14.6, 23.6, 38.2, 61.8, 100, 127.2, 161.8, 261.8, 423.6];

// Preset Scenarios
const PRESETS = [
  {
    name: "Master Reference (Nifty-50)",
    script: "Nifty-50",
    open: 962.0,
    high: 1163.0,
    low: 962.0,
    close: 1130.6,
    timeframe: "Daily",
  },
  {
    name: "NIFTY 50 (Live Index)",
    script: "NIFTY-50",
    open: 24780.0,
    high: 25150.0,
    low: 24690.0,
    close: 25080.5,
    timeframe: "Daily",
  },
  {
    name: "BANK NIFTY (Index)",
    script: "BANKNIFTY",
    open: 51200.0,
    high: 51980.0,
    low: 50950.0,
    close: 51760.0,
    timeframe: "Daily",
  },
  {
    name: "RELIANCE IND.",
    script: "RELIANCE",
    open: 2980.5,
    high: 3025.0,
    low: 2972.1,
    close: 3018.4,
    timeframe: "Daily",
  },
  {
    name: "TATA MOTORS",
    script: "TATAMOTORS",
    open: 1045.0,
    high: 1092.5,
    low: 1038.0,
    close: 1084.2,
    timeframe: "Daily",
  },
  {
    name: "HDFC BANK",
    script: "HDFCBANK",
    open: 1620.0,
    high: 1665.0,
    low: 1615.0,
    close: 1658.0,
    timeframe: "Daily",
  },
];

export default function StrategyPage({ initialData }) {
  // Input states
  const [open, setOpen] = useState(initialData?.open ?? 962.0);
  const [high, setHigh] = useState(initialData?.high ?? 1163.0);
  const [low, setLow] = useState(initialData?.low ?? 962.0);
  const [close, setClose] = useState(initialData?.close ?? 1130.6);
  const [scriptName, setScriptName] = useState(initialData?.script ?? "Nifty-50");
  const [timeframe, setTimeframe] = useState(initialData?.timeframe ?? "Daily");
  const [copiedText, setCopiedText] = useState(null);
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialData?.title ? "Custom / Selected Stock" : "Master Reference (Nifty-50)"
  );

  React.useEffect(() => {
    if (initialData) {
      if (initialData.open !== undefined) setOpen(initialData.open);
      if (initialData.high !== undefined) setHigh(initialData.high);
      if (initialData.low !== undefined) setLow(initialData.low);
      if (initialData.close !== undefined) setClose(initialData.close);
      if (initialData.timeframe) setTimeframe(initialData.timeframe);
      if (initialData.script) setScriptName(initialData.script);
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

  // Calculations for Pointer Matrix & Strategy Engine
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

    const risingUpper = {
      14.6: c + range * 0.1804,
      23.6: risingMain[23.6],
      38.2: c + range * 0.4721,
      61.8: risingMain[61.8] + range * 0.146,
      100: risingMain[100] + range * 0.1039,
      127.2: risingMain[127.2] + range * 0.1322,
      161.8: risingMain[161.8] + range * 0.382,
      261.8: risingMain[261.8] + range * 0.618,
      423.6: null,
    };

    const risingLower = {
      14.6: c + range * 0.0345,
      23.6: risingMain[23.6],
      38.2: c + range * 0.3262,
      61.8: risingMain[61.8] - range * 0.0901,
      100: risingMain[100] - range * 0.146,
      127.2: risingMain[127.2] - range * 0.1039,
      161.8: risingMain[161.8] - range * 0.1322,
      261.8: risingMain[261.8] - range * 0.382,
      423.6: null,
    };

    // Falling Channel computations
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

    const fallingUpper = {
      14.6: c - range * 0.0345,
      23.6: fallingMain[23.6],
      38.2: c - range * 0.3262,
      61.8: fallingMain[61.8] + range * 0.0901,
      100: fallingMain[100] + range * 0.146,
      127.2: fallingMain[127.2] + range * 0.1039,
      161.8: fallingMain[161.8] + range * 0.1322,
      261.8: fallingMain[261.8] + range * 0.382,
      423.6: null,
    };

    const fallingLower = {
      14.6: c - range * 0.1804,
      23.6: fallingMain[23.6],
      38.2: c - range * 0.4721,
      61.8: fallingMain[61.8] - range * 0.146,
      100: fallingMain[100] - range * 0.1039,
      127.2: fallingMain[127.2] - range * 0.1322,
      161.8: fallingMain[161.8] - range * 0.382,
      261.8: fallingMain[261.8] - range * 0.618,
      423.6: null,
    };

    // Strategy Matrix Price Targets
    const strategySignals = {
      yellow: [
        c + range * 0.236,  // 1178.05
        c + range * 0.382,  // 1207.37
        c + range * 0.552,  // 1241.54
        c + range * 0.702,  // 1271.72
        c + range * 1.0,    // 1331.60
      ],
      green: [
        c - range * 0.158,  // 1098.85
        c,                  // 1130.60 (Current Close Price)
        c + range * 0.158,  // 1162.35
        null,
        null,
      ],
      red: [
        c - range * 1.0,    // 929.60
        c - range * 0.702,  // 989.48
        c - range * 0.552,  // 1019.66
        c - range * 0.382,  // 1053.83
        c - range * 0.236,  // 1083.15
      ],
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
      strategySignals,
    };
  }, [open, high, low, close]);

  const loadPreset = (preset) => {
    setSelectedPresetName(preset.name);
    setOpen(preset.open);
    setHigh(preset.high);
    setLow(preset.low);
    setClose(preset.close);
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
            Live institutional trading strategies, breakout pointers, table tennis ranges, and multi-tier Fibonacci targets.
          </p>
        </div>

        {/* CONTROLS BAR */}
        {/* <div className="strategy-controls-bar">
          <div className="preset-selector-group">
            <label className="ctrl-label">Quick Preset</label>
            <select
              className="apple-ctrl-select"
              value={selectedPresetName}
              onChange={(e) => {
                setSelectedPresetName(e.target.value);
                const p = PRESETS.find((x) => x.name === e.target.value);
                if (p) loadPreset(p);
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              {!PRESETS.some((p) => p.name === selectedPresetName) && (
                <option value={selectedPresetName}>{selectedPresetName}</option>
              )}
            </select>
          </div>

          <div className="timeframe-toggle-group">
            <label className="ctrl-label">Timeframe</label>
            <div className="segmented-control">
              {["Daily", "Weekly", "Monthly"].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`segment-btn ${timeframe === tf ? "active" : ""}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div> */}
      </div>

      {/* COPIED TOAST */}
      {copiedText && (
        <div className="strategy-toast">
          <span className="toast-icon">✓</span>
          <span>Copied to clipboard: <strong>{copiedText}</strong></span>
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

                <div className="stair-row mini-header-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell mini-header">127.2</div>
                  <div className="stair-cell mini-header">161.8</div>
                  <div className="stair-cell mini-header">261.8</div>
                  <div className="stair-cell mini-header">423.6</div>
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

                <div className="stair-row mini-header-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell mini-header">61.8</div>
                  <div className="stair-cell mini-header">100</div>
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

                <div className="stair-row mini-header-row">
                  <div className="stair-cell mini-header">14.6</div>
                  <div className="stair-cell mini-header">23.6</div>
                  <div className="stair-cell mini-header">38.2</div>
                  <div className="stair-offset offset-6"></div>
                </div>

                <div className="stair-row">
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[14.6])}>{fmt(calcs.risingLower[14.6])}</div>
                  <div className="stair-cell yellow-highlight-cell" onClick={() => handleCopy(calcs.risingLower[23.6])}>{fmt(calcs.risingLower[23.6])}</div>
                  <div className="stair-cell dark-cell" onClick={() => handleCopy(calcs.risingLower[38.2])}>{fmt(calcs.risingLower[38.2])}</div>
                  <div className="stair-offset offset-6"></div>
                </div>
              </div>

              {/* MASTER DIVIDER */}
              <div className="matrix-horizontal-divider">
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

                <div className="stair-row mini-header-row">
                  <div className="stair-cell mini-header">14.60</div>
                  <div className="stair-cell mini-header">23.60</div>
                  <div className="stair-cell mini-header">38.20</div>
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

                <div className="stair-row mini-header-row">
                  <div className="stair-offset offset-3"></div>
                  <div className="stair-cell mini-header">61.80</div>
                  <div className="stair-cell mini-header">100.00</div>
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

                <div className="stair-row mini-header-row">
                  <div className="stair-offset offset-5"></div>
                  <div className="stair-cell mini-header">127.20</div>
                  <div className="stair-cell mini-header">161.80</div>
                  <div className="stair-cell mini-header">261.80</div>
                  <div className="stair-cell mini-header">423.60</div>
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
              <div className="summary-col-header yellow-head">High</div>
              <div className="summary-col-header yellow-head">Low</div>
              <div className="summary-col-header yellow-head">Close</div>
              <div className="summary-col-header yellow-head">Average</div>
              <div className="summary-col-header yellow-head">Range</div>
            </div>

            <div className="summary-values-card">
              <div className="summary-col-val input-wrapper">
                <input type="number" step="any" className="apple-number-input" value={open} onChange={(e) => setOpen(e.target.value)} />
              </div>
              <div className="summary-col-val input-wrapper">
                <input type="number" step="any" className="apple-number-input" value={high} onChange={(e) => setHigh(e.target.value)} />
              </div>
              <div className="summary-col-val input-wrapper">
                <input type="number" step="any" className="apple-number-input" value={low} onChange={(e) => setLow(e.target.value)} />
              </div>
              <div className="summary-col-val input-wrapper">
                <input type="number" step="any" className="apple-number-input" value={close} onChange={(e) => setClose(e.target.value)} />
              </div>
              <div className="summary-col-val readonly-val">{fmt(calcs.average, 1)}</div>
              <div className="summary-col-val readonly-val">{fmt(calcs.range, 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: INSTITUTIONAL STRATEGY & DECISION MATRIX ENGINE */}
      {/* ========================================================= */}
      <div className="strategy-card strategy-engine-block">
        <div className="card-section-label">
          <span>PART 2: STRATEGY DECISION MATRIX &amp; POINTER SCENARIOS</span>
        </div>

        {/* TOP SPLIT: CONDITIONS & SIGNAL MATRIX */}
        <div className="strategy-top-split-grid">
          
          {/* LEFT: SCRIPT CONDITIONS & TABLE TOP SCENARIOS */}
          <div className="strategy-condition-panel">
            {/* SCRIPT SELECTOR */}
            <div className="script-header-row">
              <div className="script-title-cell">Script</div>
              <div className="script-value-cell">{scriptName}</div>
            </div>

            {/* CONDITIONS TABLE */}
            <div className="conditions-table">
              <div className="condition-row">
                <div className="cond-tag purple">High</div>
                <div className="cond-desc">Above RC 14.6 &amp; Below RC 23.6.</div>
              </div>
              <div className="condition-row">
                <div className="cond-tag sage">Low</div>
                <div className="cond-desc">Above FC 100 &amp; Below FC 61.8.</div>
              </div>
              <div className="condition-row">
                <div className="cond-tag sage">Low</div>
                <div className="cond-desc status-false">FALSE</div>
              </div>
              <div className="condition-row">
                <div className="cond-tag coral">Close</div>
                <div className="cond-desc">Above FC 14.6 &amp; Below RC 14.6.</div>
              </div>

              {/* SCENARIO BANNER */}
              <div className="scenario-banner-row">
                <div className="scenario-label">Scenario</div>
                <div className="scenario-value">TABLE TOP</div>
              </div>

              {/* SECONDARY CHECKS */}
              <div className="condition-row">
                <div className="cond-tag deep-purple">High &amp; Low</div>
                <div className="cond-desc">Above FC 38.2 &amp; Below FC 23.6.</div>
              </div>
              <div className="condition-row">
                <div className="cond-tag teal">Low &amp; Close</div>
                <div className="cond-desc">Above RC 14.6 &amp; Below RC 23.6.</div>
              </div>
            </div>
          </div>

          {/* RIGHT: YELLOW / GREEN / RED SIGNAL MATRIX */}
          <div className="strategy-signal-matrix-panel">
            <div className="signal-matrix-header">
              <div className="sig-col-head yellow">YELLOW</div>
              <div className="sig-col-head green">GREEN</div>
              <div className="sig-col-head red">RED</div>
            </div>

            <div className="signal-matrix-grid">
              {/* Row 1 */}
              <div className="sig-cell yellow-val" onClick={() => handleCopy(calcs.strategySignals.yellow[0])}>
                {fmt(calcs.strategySignals.yellow[0])}
              </div>
              <div className="sig-cell green-val" onClick={() => handleCopy(calcs.strategySignals.green[0])}>
                {fmt(calcs.strategySignals.green[0])}
              </div>
              <div className="sig-cell red-val" onClick={() => handleCopy(calcs.strategySignals.red[0])}>
                {fmt(calcs.strategySignals.red[0])}
              </div>

              {/* Row 2 (Green Close Price with Highlight Box) */}
              <div className="sig-cell yellow-val" onClick={() => handleCopy(calcs.strategySignals.yellow[1])}>
                {fmt(calcs.strategySignals.yellow[1])}
              </div>
              <div className="sig-cell green-val highlight-box" onClick={() => handleCopy(calcs.strategySignals.green[1])} title="Current Close Price Level">
                {fmt(calcs.strategySignals.green[1])}
              </div>
              <div className="sig-cell red-val" onClick={() => handleCopy(calcs.strategySignals.red[1])}>
                {fmt(calcs.strategySignals.red[1])}
              </div>

              {/* Row 3 */}
              <div className="sig-cell yellow-val" onClick={() => handleCopy(calcs.strategySignals.yellow[2])}>
                {fmt(calcs.strategySignals.yellow[2])}
              </div>
              <div className="sig-cell green-val" onClick={() => handleCopy(calcs.strategySignals.green[2])}>
                {fmt(calcs.strategySignals.green[2])}
              </div>
              <div className="sig-cell red-val" onClick={() => handleCopy(calcs.strategySignals.red[2])}>
                {fmt(calcs.strategySignals.red[2])}
              </div>

              {/* Row 4 */}
              <div className="sig-cell yellow-val" onClick={() => handleCopy(calcs.strategySignals.yellow[3])}>
                {fmt(calcs.strategySignals.yellow[3])}
              </div>
              <div className="sig-cell empty-val"></div>
              <div className="sig-cell red-val" onClick={() => handleCopy(calcs.strategySignals.red[3])}>
                {fmt(calcs.strategySignals.red[3])}
              </div>

              {/* Row 5 */}
              <div className="sig-cell yellow-val" onClick={() => handleCopy(calcs.strategySignals.yellow[4])}>
                {fmt(calcs.strategySignals.yellow[4])}
              </div>
              <div className="sig-cell empty-val"></div>
              <div className="sig-cell red-val" onClick={() => handleCopy(calcs.strategySignals.red[4])}>
                {fmt(calcs.strategySignals.red[4])}
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* BOTTOM: 5 INSTITUTIONAL STRATEGY DECISION CARDS           */}
        {/* ========================================================= */}
        <div className="strategy-decision-cards-container">

          {/* CARD 1: SELLING POINTER */}
          <div className="strategy-pointer-card">
            {/* Left 3-Tier Price Stack */}
            <div className="strat-price-stack">
              <div className="price-pill yellow" onClick={() => handleCopy(1178.05)}>1178.05</div>
              <div className="price-pill red" onClick={() => handleCopy(1019.66)}>1019.66</div>
              <div className="price-pill green" onClick={() => handleCopy(1098.85)}>1098.85</div>
            </div>

            {/* Center Decision Banner */}
            <div className="strat-center-banner green-banner">
              <span className="banner-text">SELLING POINTER</span>
            </div>

            {/* Right Signal Code Stack */}
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

          {/* CARD 2: TABLE TENNIS */}
          <div className="strategy-pointer-card">
            {/* Left 3-Tier Price Stack */}
            <div className="strat-price-stack">
              <div className="price-pill yellow" onClick={() => handleCopy(1207.37)}>1207.37</div>
              <div className="price-pill red" onClick={() => handleCopy(1053.83)}>1053.83</div>
              <div className="price-pill green" onClick={() => handleCopy(1130.60)}>1130.60</div>
            </div>

            {/* Center Decision Banner */}
            <div className="strat-center-banner blue-banner">
              <span className="banner-text">TABLE TENNIS</span>
            </div>

            {/* Right Signal Code Stack */}
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

          {/* CARD 3: BUYING POINTER */}
          <div className="strategy-pointer-card">
            {/* Left 3-Tier Price Stack */}
            <div className="strat-price-stack">
              <div className="price-pill yellow" onClick={() => handleCopy(1241.54)}>1241.54</div>
              <div className="price-pill red" onClick={() => handleCopy(1083.15)}>1083.15</div>
              <div className="price-pill green" onClick={() => handleCopy(1162.35)}>1162.35</div>
            </div>

            {/* Center Decision Banner */}
            <div className="strat-center-banner green-banner">
              <span className="banner-text">BUYING POINTER</span>
            </div>

            {/* Right Signal Code Stack */}
            <div className="strat-code-stack">
              <div className="code-row">
                <span className="code-badge yellow">Y3</span>
                <span className="channel-badge yellow">RC 61.8</span>
              </div>
              <div className="code-row">
                <span className="code-badge red">R3</span>
                <span className="channel-badge red">FC 23.6</span>
              </div>
              <div className="code-row">
                <span className="code-badge green">G3</span>
                <span className="channel-badge green">RC 14.6</span>
              </div>
            </div>
          </div>

          {/* CARD 4: RISING - FALLING BREAKOUT */}
          <div className="strategy-pointer-card">
            {/* Left 3-Tier Price Stack */}
            <div className="strat-price-stack">
              <div className="price-pill yellow" onClick={() => handleCopy(1271.72)}>1271.72</div>
              <div className="price-pill red" onClick={() => handleCopy(989.48)}>989.48</div>
              <div className="price-pill green" onClick={() => handleCopy(1130.60)}>1130.60</div>
            </div>

            {/* Center Decision Banner */}
            <div className="strat-center-banner blue-banner multiline">
              <span className="banner-line">RISING - FALLING <strong>BREAKOUT</strong></span>
              <span className="banner-line">T- TOP - UPWARD <strong>BREAKDOWN</strong></span>
              <span className="banner-line sub">CLOSE PRICE</span>
            </div>

            {/* Right Signal Code Stack */}
            <div className="strat-code-stack">
              <div className="code-row">
                <span className="code-badge yellow">Y4</span>
                <span className="channel-badge yellow">RC 61.8+</span>
              </div>
              <div className="code-row">
                <span className="code-badge red">R4</span>
                <span className="channel-badge red">RC 61.8-</span>
              </div>
              <div className="code-row">
                <span className="code-badge green">G2</span>
                <span className="channel-badge green">CLOSE</span>
              </div>
            </div>
          </div>

          {/* CARD 5: RISING - FALLING BREAKOUT (EXTENDED) */}
          <div className="strategy-pointer-card">
            {/* Left 3-Tier Price Stack */}
            <div className="strat-price-stack">
              <div className="price-pill yellow" onClick={() => handleCopy(1331.60)}>1331.60</div>
              <div className="price-pill red" onClick={() => handleCopy(929.60)}>929.60</div>
              <div className="price-pill green" onClick={() => handleCopy(1130.60)}>1130.60</div>
            </div>

            {/* Center Decision Banner */}
            <div className="strat-center-banner sage-banner multiline">
              <span className="banner-line">RISING - FALLING <strong>BREAKOUT</strong></span>
              <span className="banner-line">T- TOP - UPWARD <strong>BREAKDOWN</strong></span>
              <span className="banner-line sub">CLOSE PRICE</span>
            </div>

            {/* Right Signal Code Stack */}
            <div className="strat-code-stack">
              <div className="code-row">
                <span className="code-badge yellow">Y5</span>
                <span className="channel-badge yellow">RC 100</span>
              </div>
              <div className="code-row">
                <span className="code-badge red">R5</span>
                <span className="channel-badge red">FC 100</span>
              </div>
              <div className="code-row">
                <span className="code-badge green">G2</span>
                <span className="channel-badge green">CLOSE</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
