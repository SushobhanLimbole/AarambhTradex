import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./DdReportPage.css";
import ddReportService from "../../services/ddReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { getConditionalActionDate } from "../../utils/dateUtils.js";
import { openStockAnalyticsInNewTab } from "../../utils/navigationUtils.js";

// Preset indices matching system standard
const PRESET_INDICES = [
  { value: "ALL", label: "ALL (All Stocks)", count: 2300 },
  { value: "COMMODITY-IND", label: "COMMODITY-IND (9 stocks)", count: 9 },
  { value: "CRYPTO", label: "CRYPTO (11 stocks)", count: 11 },
  { value: "DOLLAR", label: "DOLLAR (12 stocks)", count: 12 },
  { value: "F&O", label: "F&O (210 stocks)", count: 210 },
  { value: "NIFTY 50", label: "NIFTY 50 (50 stocks)", count: 50 },
  { value: "NIFTY AUTO", label: "NIFTY AUTO (15 stocks)", count: 15 },
  { value: "NIFTY BANK", label: "NIFTY BANK (12 stocks)", count: 12 },
  { value: "NIFTY CONSUMER DURABLE", label: "NIFTY CONSUMER DURABLE (13 stocks)", count: 13 },
  { value: "NIFTY ENERGY", label: "NIFTY ENERGY (37 stocks)", count: 37 },
  { value: "NIFTY FINANCE SERVICE", label: "NIFTY FINANCE SERVICE (20 stocks)", count: 20 },
  { value: "NIFTY FMCG", label: "NIFTY FMCG (15 stocks)", count: 15 },
  { value: "NIFTY HEALTHCARE", label: "NIFTY HEALTHCARE (20 stocks)", count: 20 },
  { value: "NIFTY INDIA VIX", label: "NIFTY INDIA VIX (0 stocks)", count: 0 },
  { value: "NIFTY IT", label: "NIFTY IT (10 stocks)", count: 10 },
  { value: "NIFTY MEDIA", label: "NIFTY MEDIA (8 stocks)", count: 8 },
  { value: "NIFTY METAL", label: "NIFTY METAL (15 stocks)", count: 15 },
  { value: "NIFTY MIDCAP", label: "NIFTY MIDCAP (33 stocks)", count: 33 },
  { value: "NIFTY OIL & GAS", label: "NIFTY OIL & GAS (13 stocks)", count: 13 },
  { value: "NIFTY PHARMA", label: "NIFTY PHARMA (19 stocks)", count: 19 },
  { value: "NIFTY PRIVATE BANK", label: "NIFTY PRIVATE BANK (10 stocks)", count: 10 },
  { value: "NIFTY PSU BANK", label: "NIFTY PSU BANK (12 stocks)", count: 12 },
  { value: "NIFTY REAL ESTATE", label: "NIFTY REAL ESTATE (10 stocks)", count: 10 },
  { value: "NSE-INDICES", label: "NSE-INDICES (20 stocks)", count: 20 },
  { value: "OTHER", label: "OTHER (736 stocks)", count: 736 },
  { value: "TOP 500", label: "TOP 500 (500 stocks)", count: 500 },
];

export default function DdReportPage({ onOpenStrategy, onOpenPointer, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [higherTimeframe, setHigherTimeframe] = useState("Weekly");
  const [actionDate, setActionDate] = useState(() => getConditionalActionDate());
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'BULLISH' | 'BEARISH'
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSymbol, setCopiedSymbol] = useState(null);

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    bullishCount: 0,
    bearishCount: 0,
    totalMatched: 0,
    totalScanned: 0,
  });

  const [hasScanned, setHasScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1. Fetch metadata on mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await stockService.getSymbolsMeta();
        if (res?.data) {
          if (Array.isArray(res.data.exchanges) && res.data.exchanges.length > 0) {
            setAvailableExchanges(res.data.exchanges);
          }
          if (Array.isArray(res.data.indicesWithCounts) && res.data.indicesWithCounts.length > 0) {
            const liveMap = new Map();
            res.data.indicesWithCounts.forEach((item) => {
              const cleanKey = item.name.toUpperCase().replace(/\s+/g, " ").trim();
              liveMap.set(cleanKey, item);
            });

            const merged = PRESET_INDICES.map((p) => {
              const key = p.value.toUpperCase();
              if (liveMap.has(key)) {
                const live = liveMap.get(key);
                return {
                  value: live.name,
                  label: `${live.name.toUpperCase()} (${live.count} stocks)`,
                  count: live.count,
                };
              }
              return p;
            });

            res.data.indicesWithCounts.forEach((item) => {
              const key = item.name.toUpperCase().replace(/\s+/g, " ").trim();
              const exists = merged.some((m) => m.value.toUpperCase() === key);
              if (!exists) {
                merged.push({
                  value: item.name,
                  label: `${item.name.toUpperCase()} (${item.count} stocks)`,
                  count: item.count,
                });
              }
            });

            setIndexOptions(merged);
          }
        }
      } catch (e) {
        console.warn("Meta load error in DdReportPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report (Triggered on mount for initial conditional date, and subsequently on clicking RUN)
  const handleFetchReport = useCallback(async (customDate) => {
    const targetDate = typeof customDate === "string" ? customDate : actionDate;
    setLoading(true);
    setHasScanned(true);
    setError("");
    try {
      const res = await ddReportService.getDdReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: targetDate || undefined,
        filterType: "ALL",
      });

      if (res?.data && Array.isArray(res.data)) {
        setReportData(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
        if (res.higherTimeframe) {
          setHigherTimeframe(res.higherTimeframe);
        }
        if (res.rawActionDate && !targetDate) {
          setActionDate(res.rawActionDate);
        }
      } else {
        setReportData([]);
      }
    } catch (err) {
      console.error("Twin Tower Report Error:", err);
      setError(err.message || "Failed to load Twin Tower report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate]);

  // Initial load on mount using getConditionalActionDate()
  useEffect(() => {
    const initDate = getConditionalActionDate();
    handleFetchReport(initDate);
  }, []);

  // Instant in-memory filter
  const filteredData = useMemo(() => {
    let list = reportData;
    const norm = String(filterType).toUpperCase();
    if (norm === "BULLISH" || norm === "BULLISH_DD") {
      list = list.filter((r) => r.isBullishTwinTower || r.type === "BULLISH");
    } else if (norm === "BEARISH" || norm === "BEARISH_DD") {
      list = list.filter((r) => r.isBearishTwinTower || r.type === "BEARISH");
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((row) => {
      const sym = (row.symbol || "").toLowerCase();
      const cleanSym = stripSymbolSuffix(row.symbol || row.cleanSymbol || "").toLowerCase();
      const rawClean = (row.cleanSymbol || "").toLowerCase();
      const weekly = (row.weeklyStatus || "").toLowerCase();
      const tt = (row.twinTower || "").toLowerCase();
      return sym.includes(q) || cleanSym.includes(q) || rawClean.includes(q) || weekly.includes(q) || tt.includes(q);
    });
  }, [reportData, filterType, searchQuery]);

  // Copy symbol helper
  const handleCopySymbol = (sym) => {
    if (!sym) return;
    navigator.clipboard.writeText(sym);
    setCopiedSymbol(sym);
    setTimeout(() => {
      setCopiedSymbol(null);
    }, 2000);
  };

  // Open stock analytics data summary page in a new tab with date highlighting
  const handleOpenStockAnalyticsInNewTab = (row) => {
    const fullSym = row.symbol || row.cleanSymbol;
    if (!fullSym) return;

    openStockAnalyticsInNewTab({
      symbol: fullSym,
      exchange: exchange || "NSE",
      indice: indexVal || "ALL",
      timeframe: timeframe || "Daily",
      highlightDate: row.rawDate || row.rawDay2Date || row.day2Date || actionDate,
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = [
      "SR.NO",
      "TICKER NAME",
      "PRICE",
      "WEEKLY STATUS",
      "TWIN TOWER",
      "DAY 1 FORMATION",
      "DAY 2 FORMATION",
      "DATE",
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      stripSymbolSuffix(r.cleanSymbol || r.symbol),
      r.price,
      `"${r.weeklyStatus}"`,
      `"${r.twinTower}"`,
      `"${r.day1State}"`,
      `"${r.day2State}"`,
      r.date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `twin_tower_report_${actionDate || "latest"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dd-report-wrapper">
      {/* 1. EXCEL SPECIFICATION MATRIX HEADER */}
      <div className="dd-matrix-card">
        <div className="dd-matrix-grid">
          {/* BULLISH TWIN TOWER SECTION */}
          <div
            className={`dd-section-box section-bullish ${filterType === "BULLISH" ? "active-box" : ""}`}
            onClick={() => setFilterType(filterType === "BULLISH" ? "ALL" : "BULLISH")}
          >
            <div className="dd-section-header">
              <span className="dd-badge-kicker kicker-green">DIRECTIONAL SHIFT</span>
              <h2 className="dd-sec-title title-green">BULLISH Twin Tower</h2>
            </div>

            <div className="dd-steps-container">
              {/* Day 1 */}
              <div className="dd-step-row">
                <span className="dd-step-label">DAY 1</span>
                <div className="dd-state-block block-red">HLC LOWER</div>
              </div>

              {/* Day 2 */}
              <div className="dd-step-row">
                <span className="dd-step-label">DAY 2</span>
                <div className="dd-state-block block-green">HLC HIGHER</div>
              </div>
            </div>

            <div className="dd-section-footer">
              <div className="dd-counter-badge counter-green">
                <span>Matched: <strong>{summary.bullishCount || 0}</strong> stocks</span>
              </div>
            </div>
          </div>

          {/* BEARISH TWIN TOWER SECTION */}
          <div
            className={`dd-section-box section-bearish ${filterType === "BEARISH" ? "active-box" : ""}`}
            onClick={() => setFilterType(filterType === "BEARISH" ? "ALL" : "BEARISH")}
          >
            <div className="dd-section-header">
              <span className="dd-badge-kicker kicker-red">DIRECTIONAL SHIFT</span>
              <h2 className="dd-sec-title title-red">BEARISH Twin Tower</h2>
            </div>

            <div className="dd-steps-container">
              {/* Day 1 */}
              <div className="dd-step-row">
                <span className="dd-step-label">DAY 1</span>
                <div className="dd-state-block block-green">HLC HIGHER</div>
              </div>

              {/* Day 2 */}
              <div className="dd-step-row">
                <span className="dd-step-label">DAY 2</span>
                <div className="dd-state-block block-red">HLC LOWER</div>
              </div>
            </div>

            <div className="dd-section-footer">
              <div className="dd-counter-badge counter-red">
                <span>Matched: <strong>{summary.bearishCount || 0}</strong> stocks</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY ACCURACY & PERFORMANCE RIBBON */}
        <div className="dd-summary-ribbon">
          <div className="dd-ribbon-left">
            <span className="ribbon-icon">⚡</span>
            <span className="ribbon-title">INSTITUTIONAL TWIN TOWER DIRECTIONAL SHIFT ENGINE</span>
          </div>
          <div className="dd-ribbon-stats">
            <div className="dd-stat-pill">
              <span className="lbl">Total Formations:</span>
              <span className="val highlight">{summary.totalMatched || 0}</span>
            </div>
            <div className="dd-stat-pill">
              <span className="lbl">🟢 Bullish Twin Tower:</span>
              <span className="val text-bull">{summary.bullishCount || 0}</span>
            </div>
            <div className="dd-stat-pill">
              <span className="lbl">🔴 Bearish Twin Tower:</span>
              <span className="val text-bear">{summary.bearishCount || 0}</span>
            </div>
            <div className="dd-stat-pill">
              <span className="lbl">Total Evaluated:</span>
              <span className="val">{summary.totalScanned || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR */}
      <div className="dd-toolbar">
        {onBack && (
          <button
            type="button"
            className="dd-back-btn"
            onClick={onBack}
            title="Return to 8 Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* Exchange */}
        <div className="dd-control-group">
          <label className="dd-label">Exchange</label>
          <select
            className="dd-select"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
          >
            <option value="ALL">ALL</option>
            {availableExchanges.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </div>

        {/* Index */}
        <div className="dd-control-group dd-wide">
          <label className="dd-label">Index</label>
          <select
            className="dd-select"
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
          >
            {indexOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div className="dd-control-group">
          <label className="dd-label">Timeframe</label>
          <select
            className="dd-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>

        {/* Action Date */}
        <div className="dd-control-group">
          <label className="dd-label">Action Date</label>
          <input
            type="date"
            className="dd-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="dd-filter-pills">
          <button
            type="button"
            className={`dd-pill-btn ${filterType === "ALL" ? "active" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All Stocks ({summary.totalMatched || 0})
          </button>
        </div>

        {/* Actions */}
        <button
          type="button"
          className="dd-run-btn"
          onClick={() => handleFetchReport()}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN"}
        </button>

        <button
          type="button"
          className="dd-export-btn"
          onClick={handleExportCSV}
          disabled={!filteredData.length}
          title="Export table to CSV"
        >
          📥 CSV
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="dd-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 3. SEARCH & TABLE STATS BAR */}
      <div className="dd-search-bar-row">
        <div className="dd-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker symbol (e.g. RELIANCE, TCS, INFY)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dd-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="dd-table-counts">
          <span>
            Showing <strong>{filteredData.length}</strong> of <strong>{reportData.length}</strong> matched stocks for <strong>{actionDate || "Action Date"}</strong>
          </span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE (Columns: SR.NO, TICKER NAME, COMPARISON STATUS, TWIN TOWER, ACTIONS) */}
      <div className="dd-table-card">
        <div className="dd-table-scroll">
          <table className="dd-table">
            <thead>
              <tr>
                <th className="th-sr">SR.NO</th>
                <th className="th-sym">TICKER NAME</th>
                <th className="th-weekly">{higherTimeframe ? `${higherTimeframe.toUpperCase()} STATUS` : "WEEKLY STATUS"}</th>
                <th className="th-twintower">TWIN TOWER</th>
                <th className="th-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="dd-empty-cell">
                    <div className="dd-loading-box">
                      <span className="dd-spinner">⏳</span>
                      <span>Calculating Bullish &amp; Bearish Twin Tower Formations...</span>
                    </div>
                  </td>
                </tr>
              ) : !hasScanned ? (
                <tr>
                  <td colSpan={5} className="dd-empty-cell">
                    <div className="dd-loading-box">
                      <span className="dd-spinner">⚡</span>
                      <span>Select filters above and click <strong>&quot;RUN SCANNER&quot;</strong> to find Twin Tower formations.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dd-empty-cell">
                    <div className="dd-loading-box">
                      <span className="dd-spinner">📊</span>
                      <span>No stocks formed a Twin Tower pattern on {actionDate || "this date"}.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol || row.cleanSymbol);
                  return (
                    <tr
                      key={row.symbol || idx}
                      className={`dd-row ${row.isBullishTwinTower ? "row-bullish" : row.isBearishTwinTower ? "row-bearish" : ""}`}
                    >
                      {/* 1. SR.NO */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* 2. TICKER NAME */}
                      <td className="td-sym">
                        <div className="ticker-cell">
                          <span
                            className="ticker-badge-link"
                            onClick={() => handleOpenStockAnalyticsInNewTab(row)}
                            title={`Open ${cleanSym} Data Summary (Last 6 Months) in New Tab`}
                          >
                            {cleanSym}
                          </span>
                          <span className="price-sub">₹{Number(row.price || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* 3. WEEKLY STATUS */}
                      <td className="td-weekly">
                        {row.weeklyStatus === "HLC HIGHER" ? (
                          <span className="weekly-badge badge-hlc-higher">
                            🟢 HLC HIGHER
                          </span>
                        ) : row.weeklyStatus === "HLC LOWER" ? (
                          <span className="weekly-badge badge-hlc-lower">
                            🔴 HLC LOWER
                          </span>
                        ) : (
                          <span className="weekly-badge badge-neutral">
                            ⚪ NEUTRAL
                          </span>
                        )}
                      </td>

                      {/* 4. TWIN TOWER */}
                      <td className="td-twintower">
                        {row.isBullishTwinTower ? (
                          <div className="twintower-badge-box badge-bullish-box">
                            <span className="tt-icon">🟢</span>
                            <span className="tt-name">BULLISH Twin Tower</span>
                            <span className="tt-sub-steps">(D1: Lower → D2: Higher)</span>
                          </div>
                        ) : row.isBearishTwinTower ? (
                          <div className="twintower-badge-box badge-bearish-box">
                            <span className="tt-icon">🔴</span>
                            <span className="tt-name">BEARISH Twin Tower</span>
                            <span className="tt-sub-steps">(D1: Higher → D2: Lower)</span>
                          </div>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>

                      {/* 5. ACTIONS */}
                      <td className="td-actions">
                        <div className="row-action-btns">
                          <button
                            type="button"
                            className="mini-action-btn copy-btn"
                            onClick={() => handleCopySymbol(cleanSym)}
                            title="Copy symbol to clipboard"
                          >
                            {copiedSymbol === cleanSym ? "✓ Copied" : "Copy"}
                          </button>

                          <button
                            type="button"
                            className="mini-action-btn strat-btn"
                            onClick={() => {
                              if (onOpenStrategy) {
                                onOpenStrategy({
                                  symbol: row.symbol,
                                  script: cleanSym,
                                  timeframe: "Daily",
                                });
                              }
                            }}
                            title="Open Strategy Decision Matrix"
                          >
                            Strategy
                          </button>
                        </div>
                      </td>
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
