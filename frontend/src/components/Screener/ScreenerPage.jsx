import React, { useState, useEffect } from "react";
import "./ScreenerPage.css";
import screenerService from "../../services/screenerService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

// Trigger options grouped by category
const TRIGGER_GROUPS = [
  {
    category: "Yellow Category",
    colorKey: "yellow",
    triggers: ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"],
    desc: "Breakout & Pivot Extensions",
  },
  {
    category: "Green Category",
    colorKey: "green",
    triggers: ["G1", "G2", "G3", "G4", "G5", "G6"],
    desc: "Rotation & Pullback Support Levels",
  },
  {
    category: "Red Category",
    colorKey: "red",
    triggers: ["R1", "R2", "R3", "R4", "R5", "R6"],
    desc: "Falling Channel & Breakdown Thresholds",
  },
];

const ALL_TRIGGERS = TRIGGER_GROUPS.flatMap((g) => g.triggers);

const TIMEFRAMES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

const PATTERNS = [
  "Table Tennis",
  "Table Top",
  "Rising Jack",
  "Falling Duck",
  "Upward Rotation",
];

export default function ScreenerPage({ onOpenStrategy, onOpenPointer, onBack }) {
  // Default helper dates
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // Market Filters State (Exchange & Index)
  const [selectedExchange, setSelectedExchange] = useState("NSE");
  const [selectedIndice, setSelectedIndice] = useState("ALL");
  const [availableExchanges, setAvailableExchanges] = useState(["ALL", "NSE", "BSE", "CRYPTO", "METALS"]);
  const [availableIndices, setAvailableIndices] = useState([]);

  // CMP1 (Current Market Period) State
  const [cmp1StartDate, setCmp1StartDate] = useState(oneMonthAgo);
  const [cmp1EndDate, setCmp1EndDate] = useState(today);
  const [cmp1Timeframe, setCmp1Timeframe] = useState("DAILY");

  // CMP2 (Historical Reference Period) State
  const [cmp2StartDate, setCmp2StartDate] = useState(threeMonthsAgo);
  const [cmp2EndDate, setCmp2EndDate] = useState(oneMonthAgo);
  const [cmp2Timeframe, setCmp2Timeframe] = useState("DAILY");

  // Pattern & Multi-Trigger State (Strictly Table Tennis, Table Top, Rising Jack, Falling Duck, Upward Rotation)
  const [pattern, setPattern] = useState("Table Top");
  const [selectedTriggers, setSelectedTriggers] = useState(["Y1"]);

  // Results & Execution State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSymbol, setCopiedSymbol] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Fetch metadata filters on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadFilters() {
      try {
        const metaRes = await stockService.getSymbolsMeta();
        if (!isCancelled && metaRes?.data) {
          if (Array.isArray(metaRes.data.exchanges) && metaRes.data.exchanges.length > 0) {
            setAvailableExchanges(["ALL", ...metaRes.data.exchanges]);
          }
          if (Array.isArray(metaRes.data.indices) && metaRes.data.indices.length > 0) {
            setAvailableIndices(metaRes.data.indices);
          }
        }
      } catch (err) {
        console.warn("Failed to load metadata in screener:", err);
      }
    }
    loadFilters();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Toggle individual trigger in/out of selection
  const handleToggleTrigger = (trig) => {
    setSelectedTriggers((prev) => {
      if (prev.includes(trig)) {
        const updated = prev.filter((t) => t !== trig);
        return updated.length > 0 ? updated : ["Y1"];
      } else {
        return [...prev, trig];
      }
    });
  };

  // Toggle entire category
  const handleToggleCategory = (catTriggers) => {
    const allSelected = catTriggers.every((t) => selectedTriggers.includes(t));
    if (allSelected) {
      const remaining = selectedTriggers.filter((t) => !catTriggers.includes(t));
      setSelectedTriggers(remaining.length > 0 ? remaining : ["Y1"]);
    } else {
      setSelectedTriggers((prev) => Array.from(new Set([...prev, ...catTriggers])));
    }
  };

  // Select all available triggers
  const handleSelectAllTriggers = () => {
    setSelectedTriggers(ALL_TRIGGERS);
  };

  // Reset to single default trigger
  const handleResetTriggers = () => {
    setSelectedTriggers(["Y1"]);
  };

  // Handle Form Submission
  const handleGenerateReport = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      exchange: selectedExchange,
      indice: selectedIndice,
      cmp1: {
        startDate: cmp1StartDate,
        endDate: cmp1EndDate,
        timeframe: cmp1Timeframe,
      },
      cmp2: {
        startDate: cmp2StartDate,
        endDate: cmp2EndDate,
        timeframe: cmp2Timeframe,
      },
      pattern,
      triggers: selectedTriggers,
      trigger: selectedTriggers.join(", "),
    };

    try {
      const response = await screenerService.runScreener(payload);
      if (response?.results) {
        setResults(response);
      } else {
        setResults({ results: [], count: 0 });
      }
    } catch (err) {
      setError(err.message || "Failed to generate breakout report.");
    } finally {
      setLoading(false);
    }
  };

  // Lookup details for a symbol if provided by backend
  const detailsMap = React.useMemo(() => {
    const map = {};
    if (results?.details && Array.isArray(results.details)) {
      results.details.forEach((d) => {
        if (d?.symbol) map[d.symbol] = d;
      });
    }
    return map;
  }, [results]);

  // Filter results by search query (matches raw/clean symbol or matched trigger)
  const filteredSymbols = results?.results
    ? results.results.filter((sym) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        if (sym.toLowerCase().includes(q) || stripSymbolSuffix(sym).toLowerCase().includes(q)) return true;
        const detail = detailsMap[sym];
        if (detail?.matchedTriggers?.some((m) => m.trigger.toLowerCase().includes(q))) return true;
        return false;
      })
    : [];

  const handleCopySymbol = (sym) => {
    const textToCopy = stripSymbolSuffix(sym);
    navigator.clipboard?.writeText(textToCopy);
    setCopiedSymbol(textToCopy);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  const handleCopyAll = () => {
    if (!results?.results || results.results.length === 0) return;
    const cleanList = results.results.map((s) => stripSymbolSuffix(s));
    navigator.clipboard?.writeText(cleanList.join(", "));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Helper to color-code trigger badges
  const getTriggerClass = (trig) => {
    if (trig.startsWith("Y")) return "trigger-badge-yellow";
    if (trig.startsWith("G")) return "trigger-badge-green";
    if (trig.startsWith("R")) return "trigger-badge-red";
    return "";
  };

  return (
    <div className="screener-page-wrapper">
      {/* HEADER HERO */}
      {/* <div className="screener-header-container">
        <div className="screener-title-area">
          <div className="screener-badge-pill">
            <span className="screener-pulsing-dot"></span>
            <span>BREAKOUT SCANNER ENGINE</span>
          </div>
          <h1 className="screener-heading">Stock Market Screener</h1>
          <p className="screener-subheading">
            Compare Current Market Period (CMP1) against Historical Reference (CMP2) to screen for institutional mathematical breakout triggers.
          </p>
        </div>
      </div> */}

      {onBack && (
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#334155",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "all 0.15s ease",
            }}
          >
            ← Back to Report Cards
          </button>
        </div>
      )}

      {/* CONTROLS FORM */}
      <form className="screener-form" onSubmit={handleGenerateReport}>
        
        {/* TOP SPLIT: CMP1 vs CMP2 CONFIGURATION */}
        <div className="screener-period-grid">
          
          {/* CMP1 CARD */}
          <div className="screener-card cmp1-card">
            <div className="card-header-badge cmp1-badge">
              <span className="badge-icon">📍</span>
              <span>CMP1 (Current Market Period)</span>
            </div>
            
            <div className="screener-input-group">
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp1StartDate}
                onChange={(e) => setCmp1StartDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">End Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp1EndDate}
                onChange={(e) => setCmp1EndDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">Timeframe</label>
              <select
                className="apple-select-input"
                value={cmp1Timeframe}
                onChange={(e) => setCmp1Timeframe(e.target.value)}
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={`cmp1-${tf}`} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CMP2 CARD */}
          <div className="screener-card cmp2-card">
            <div className="card-header-badge cmp2-badge">
              <span className="badge-icon">🏛️</span>
              <span>CMP2 (Historical Reference Period)</span>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp2StartDate}
                onChange={(e) => setCmp2StartDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">End Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp2EndDate}
                onChange={(e) => setCmp2EndDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">Timeframe</label>
              <select
                className="apple-select-input"
                value={cmp2Timeframe}
                onChange={(e) => setCmp2Timeframe(e.target.value)}
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={`cmp2-${tf}`} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* MARKET & PATTERN SETUP CARD */}
        <div className="screener-card pattern-card">
          <div className="card-header-badge pattern-badge">
            <span className="badge-icon">🌐</span>
            <span>Market & Pattern Setup</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", width: "100%" }}>
            <div className="screener-input-group">
              <label className="input-label">Exchange</label>
              <select
                className="apple-select-input"
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
              >
                {availableExchanges.map((ex) => (
                  <option key={`ex-${ex}`} value={ex}>
                    {ex === "ALL" ? "All Exchanges (NSE, BSE, Crypto, Metals)" : ex}
                  </option>
                ))}
              </select>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Index / Sector</label>
              <select
                className="apple-select-input"
                value={selectedIndice}
                onChange={(e) => setSelectedIndice(e.target.value)}
              >
                <option value="ALL">All Indices</option>
                {availableIndices.map((idx) => (
                  <option key={`idx-${idx}`} value={idx}>
                    {idx}
                  </option>
                ))}
              </select>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Pointer Pattern Type</label>
              <select
                className="apple-select-input pattern-select"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              >
                {PATTERNS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* MULTI-TRIGGER SELECTOR CARD */}
        <div className="screener-card trigger-card">
          <div className="trigger-card-header">
            <div className="card-header-badge trigger-badge">
              <span className="badge-icon">🎯</span>
              <span>Trigger Selector (Multiple Breakout Levels for Comparison)</span>
            </div>

            {/* Quick Actions Bar */}
            <div className="trigger-quick-actions">
              <button
                type="button"
                className="quick-action-pill"
                onClick={handleSelectAllTriggers}
                title="Select all 17 trigger levels"
              >
                ✓ Select All (17)
              </button>
              <button
                type="button"
                className="quick-action-pill yellow-pill-action"
                onClick={() => handleToggleCategory(["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"])}
              >
                + Yellow Group
              </button>
              <button
                type="button"
                className="quick-action-pill green-pill-action"
                onClick={() => handleToggleCategory(["G1", "G2", "G3", "G4", "G5", "G6"])}
              >
                + Green Group
              </button>
              <button
                type="button"
                className="quick-action-pill red-pill-action"
                onClick={() => handleToggleCategory(["R1", "R2", "R3", "R4", "R5"])}
              >
                + Red Group
              </button>
              <button
                type="button"
                className="quick-action-pill reset-pill-action"
                onClick={handleResetTriggers}
                title="Reset to default trigger Y1"
              >
                ↺ Reset (Y1)
              </button>
            </div>
          </div>

          {/* Active Selection Chips Summary */}
          <div className="trigger-selection-summary">
            <div className="summary-label-group">
              <span className="summary-title">Selected for Comparison ({selectedTriggers.length}):</span>
            </div>
            <div className="selected-chips-list">
              {selectedTriggers.map((trig) => (
                <span key={`chip-${trig}`} className={`selected-chip ${getTriggerClass(trig)}`}>
                  <strong>{trig}</strong>
                  {selectedTriggers.length > 1 && (
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => handleToggleTrigger(trig)}
                      title={`Remove ${trig}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* TRIGGER GROUPS */}
          <div className="trigger-groups-wrapper">
            {TRIGGER_GROUPS.map((group) => {
              const allCategorySelected = group.triggers.every((t) => selectedTriggers.includes(t));
              return (
                <div key={group.category} className={`trigger-category-block ${group.colorKey}-block`}>
                  <div className="trigger-category-title">
                    <div className="category-left-info">
                      <span className={`cat-pill ${group.colorKey}-pill`}>{group.category}</span>
                      <span className="cat-desc">{group.desc}</span>
                    </div>

                    <button
                      type="button"
                      className={`cat-toggle-btn ${allCategorySelected ? "cat-active" : ""}`}
                      onClick={() => handleToggleCategory(group.triggers)}
                    >
                      {allCategorySelected ? "Deselect Group" : "Select Group"}
                    </button>
                  </div>

                  <div className="trigger-buttons-grid">
                    {group.triggers.map((trig) => {
                      const isSelected = selectedTriggers.includes(trig);
                      return (
                        <button
                          key={trig}
                          type="button"
                          className={`trigger-btn ${group.colorKey}-btn ${isSelected ? "selected" : ""}`}
                          onClick={() => handleToggleTrigger(trig)}
                        >
                          <span className="trigger-name">{trig}</span>
                          {isSelected && <span className="selected-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SUBMIT ACTION BUTTON */}
        <div className="screener-action-container">
          <button
            type="submit"
            className={`generate-report-btn ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                <span>Screening Database...</span>
              </>
            ) : (
              <>
                <span>⚡ Generate Breakout Report</span>
                <span className="btn-badge-trigger">
                  {pattern} • {selectedTriggers.length} {selectedTriggers.length === 1 ? "Trigger" : "Triggers"} (
                  {selectedTriggers.slice(0, 4).join(", ")}
                  {selectedTriggers.length > 4 ? ` +${selectedTriggers.length - 4}` : ""})
                </span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* ERROR BANNER */}
      {error && (
        <div className="screener-error-banner">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* RESULTS DATA TABLE SECTION */}
      {results && (
        <div className="screener-card results-card">
          <div className="results-header">
            <div className="results-title-group">
              <span className="results-badge">RESULTS REPORT</span>
              <h2 className="results-heading">Qualifying Breakout Stocks</h2>
              <span className="results-count-pill">
                {results.count} {results.count === 1 ? "Stock" : "Stocks"} Found
              </span>
              <span className="results-trigger-summary-pill">
                Compared: {selectedTriggers.join(", ")}
              </span>
            </div>

            <div className="results-actions">
              <div className="search-box-wrapper">
                <input
                  type="text"
                  placeholder="Filter symbols or triggers..."
                  className="results-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="action-pill-btn"
                onClick={handleCopyAll}
                disabled={results.results.length === 0}
              >
                {copiedAll ? "✓ Copied All" : "📋 Copy All Symbols"}
              </button>
            </div>
          </div>

          {/* TABLE */}
          {filteredSymbols.length > 0 ? (
            <div className="results-table-wrapper">
              <table className="screener-table">
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    <th className="col-stock-name">STOCK NAME</th>
                    <th className="col-breakout-triggers">MATCHED BREAKOUT TRIGGERS</th>
                    <th className="col-cmp1-close">CMP1 CLOSE</th>
                    <th className="col-action">QUICK ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSymbols.map((symbol, index) => {
                    const detail = detailsMap[symbol];
                    const matched = detail?.matchedTriggers || [];
                    const cmp1Close = detail?.cmp1Close;

                    return (
                      <tr key={symbol} className="screener-row">
                        <td className="col-idx">{index + 1}</td>
                        <td className="col-stock-name">
                          <div className="stock-name-cell">
                            <span className="stock-symbol-badge">{stripSymbolSuffix(symbol)}</span>
                            {detail?.exchange && (
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                marginLeft: "6px",
                                background: detail.exchange === "CRYPTO" ? "#ede9fe" : detail.exchange === "METALS" ? "#fef3c7" : "#e0f2fe",
                                color: detail.exchange === "CRYPTO" ? "#6d28d9" : detail.exchange === "METALS" ? "#92400e" : "#0369a1",
                                border: "1px solid currentColor",
                                opacity: 0.9,
                              }}>
                                {detail.exchange}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-breakout-triggers">
                          <div className="matched-triggers-cell">
                            {matched.length > 0 ? (
                              matched.map((m) => (
                                <span
                                  key={`${symbol}-${m.trigger}`}
                                  className={`matched-trigger-tag ${getTriggerClass(m.trigger)}`}
                                  title={`Trigger Level: ₹${m.triggerPrice} (+${m.pctBreakout}%)`}
                                >
                                  <strong>{m.trigger}</strong>
                                  {m.triggerPrice && <span className="tag-price">@ ₹{m.triggerPrice}</span>}
                                  {m.pctBreakout !== undefined && (
                                    <span className="tag-pct">+{m.pctBreakout}%</span>
                                  )}
                                </span>
                              ))
                            ) : (
                              <span className="breakout-match-tag">
                                Breakout Match ({selectedTriggers.join(", ")})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-cmp1-close">
                          <span className="cmp1-price-badge">
                            {cmp1Close !== undefined ? `₹${cmp1Close.toFixed(2)}` : "—"}
                          </span>
                        </td>
                        <td className="col-action">
                          <div className="row-action-btns">
                            <button
                              type="button"
                              className="mini-action-btn copy-btn"
                              onClick={() => handleCopySymbol(stripSymbolSuffix(symbol))}
                              title="Copy symbol to clipboard"
                            >
                              {copiedSymbol === stripSymbolSuffix(symbol) || copiedSymbol === symbol ? "✓ Copied" : "Copy"}
                            </button>

                            {(onOpenStrategy || onOpenPointer) && (
                              <button
                                type="button"
                                className="mini-action-btn pointer-btn"
                                onClick={() => {
                                  const handler = onOpenStrategy || onOpenPointer;
                                  handler({
                                    symbol,
                                    script: stripSymbolSuffix(symbol),
                                    open: detail?.open,
                                    high: detail?.high,
                                    low: detail?.low,
                                    close: detail?.close || detail?.cmp1Close,
                                    cmp1Close: detail?.cmp1Close,
                                    range: detail?.range,
                                    average: detail?.average,
                                    timeframe: cmp2Timeframe || "Daily",
                                    title: `${stripSymbolSuffix(symbol)} - Strategy Decision Matrix`,
                                  });
                                }}
                                title="Open in Strategy Decision Matrix"
                              >
                                View →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-results-state">
              <div className="no-results-icon">🔍</div>
              <h3>No Stocks Matched the Breakout Filter</h3>
              <p>
                No stocks had CMP1 Close &gt; CMP2 Trigger ({selectedTriggers.join(", ")}) for {pattern}. Try selecting additional trigger levels or adjusting the period dates.
              </p>
            </div>
          )}
        </div>
      )}

      {/* INITIAL PROMPT WHEN NO SEARCH EXECUTED YET */}
      {!results && !loading && (
        <div className="screener-empty-prompt">
          <div className="prompt-icon">📊</div>
          <h3>Ready to Scan Market</h3>
          <p>
            Configure CMP1 vs CMP2, select one or multiple breakout triggers (Y1–Y6, G1–G6, R1–R5), and click <strong>Generate Breakout Report</strong> to compare stocks across levels.
          </p>
        </div>
      )}
    </div>
  );
}
