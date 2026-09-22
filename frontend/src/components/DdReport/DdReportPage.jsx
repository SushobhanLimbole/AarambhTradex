import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./DdReportPage.css";
import ddReportService from "../../services/ddReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

const TIMEFRAMES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

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
  const [actionDate, setActionDate] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'BULLISH_DD' | 'BEARISH_DD' | 'ALL_DD'
  const [searchQuery, setSearchQuery] = useState("");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    bullishDdCount: 0,
    bearishDdCount: 0,
    totalDdCount: 0,
    totalScanned: 0,
  });

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

  // 2. Fetch Report
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await ddReportService.getDdReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: actionDate || undefined,
        filterType,
      });

      if (res?.data && Array.isArray(res.data)) {
        setReportData(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
        if (res.rawActionDate && !actionDate) {
          setActionDate(res.rawActionDate);
        }
      } else {
        setReportData([]);
      }
    } catch (err) {
      console.error("DD Report Error:", err);
      setError(err.message || "Failed to load DD report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate, filterType]);

  useEffect(() => {
    handleFetchReport();
  }, [handleFetchReport]);

  const filteredData = useMemo(() => {
    return reportData.filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sym = (row.symbol || "").toLowerCase();
      const type = (row.ddType || "").toLowerCase();
      const d1 = (row.day1State || "").toLowerCase();
      const d2 = (row.day2State || "").toLowerCase();
      return sym.includes(q) || type.includes(q) || d1.includes(q) || d2.includes(q);
    });
  }, [reportData, searchQuery]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = [
      "SR",
      "Symbol",
      "Price",
      "DD Classification",
      "Day 1 State",
      "Day 2 State",
      "Margin %",
      "Day 2 High",
      "Day 2 Low",
      "Day 1 Date",
      "Day 1 Close",
      "Action Date",
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      r.symbol,
      r.price,
      `"${r.ddType}"`,
      `"${r.day1State}"`,
      `"${r.day2State}"`,
      `${r.margin}%`,
      r.high,
      r.low,
      r.day1Date,
      r.day1Close,
      r.date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dd_report_${timeframe}_${actionDate || "latest"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dd-report-wrapper">
      {/* 1. EXCEL SPECIFICATION MATRIX HEADER (MATCHING USER SCREENSHOT PRECISELY) */}
      <div className="dd-matrix-card">
        <div className="dd-matrix-grid">
          {/* BULLISH DD SECTION */}
          <div className="dd-section-box section-bullish">
            <div className="dd-section-header">
              <span className="dd-badge-kicker kicker-green">DIRECTIONAL SHIFT</span>
              <h2 className="dd-sec-title title-green">BULLISH DD</h2>
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
              <span className="dd-scope-pill">FOR ALL TIME FRAME</span>
              <div className="dd-counter-badge counter-green">
                <span>Matched: <strong>{summary.bullishDdCount || 0}</strong> stocks</span>
              </div>
            </div>
          </div>

          {/* BEARISH DD SECTION */}
          <div className="dd-section-box section-bearish">
            <div className="dd-section-header">
              <span className="dd-badge-kicker kicker-red">DIRECTIONAL SHIFT</span>
              <h2 className="dd-sec-title title-red">BEARISH DD</h2>
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
              <span className="dd-scope-pill">FOR ALL TIME FRAME</span>
              <div className="dd-counter-badge counter-red">
                <span>Matched: <strong>{summary.bearishDdCount || 0}</strong> stocks</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY ACCURACY & PERFORMANCE RIBBON */}
        <div className="dd-summary-ribbon">
          <div className="dd-ribbon-left">
            <span className="ribbon-icon">⚡</span>
            <span className="ribbon-title">INSTITUTIONAL DIRECTIONAL DISTRIBUTION (DD) ENGINE</span>
          </div>
          <div className="dd-ribbon-stats">
            <div className="dd-stat-pill">
              <span className="lbl">Total DD Flips:</span>
              <span className="val highlight">{summary.totalDdCount || 0}</span>
            </div>
            <div className="dd-stat-pill">
              <span className="lbl">🟢 Bullish DD:</span>
              <span className="val text-bull">{summary.bullishDdCount || 0}</span>
            </div>
            <div className="dd-stat-pill">
              <span className="lbl">🔴 Bearish DD:</span>
              <span className="val text-bear">{summary.bearishDdCount || 0}</span>
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
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
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
            All Stocks ({summary.totalScanned})
          </button>
          <button
            type="button"
            className={`dd-pill-btn pill-flips ${filterType === "ALL_DD" ? "active" : ""}`}
            onClick={() => setFilterType("ALL_DD")}
          >
            ⚡ All DD Flips ({summary.totalDdCount})
          </button>
          <button
            type="button"
            className={`dd-pill-btn pill-bullish ${filterType === "BULLISH_DD" ? "active" : ""}`}
            onClick={() => setFilterType("BULLISH_DD")}
          >
            🟢 Bullish DD ({summary.bullishDdCount})
          </button>
          <button
            type="button"
            className={`dd-pill-btn pill-bearish ${filterType === "BEARISH_DD" ? "active" : ""}`}
            onClick={() => setFilterType("BEARISH_DD")}
          >
            🔴 Bearish DD ({summary.bearishDdCount})
          </button>
        </div>

        {/* Actions */}
        <button
          type="button"
          className="dd-run-btn"
          onClick={handleFetchReport}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN SCANNER"}
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
            Showing <strong>{filteredData.length}</strong> of <strong>{reportData.length}</strong> stocks
          </span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE */}
      <div className="dd-table-card">
        <div className="dd-table-scroll">
          <table className="dd-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th className="th-sym">TICKER</th>
                <th className="th-price">PRICE (CLOSE)</th>
                <th className="th-type">DD CLASSIFICATION</th>
                <th className="th-d1">DAY 1 FORMATION</th>
                <th className="th-d2">DAY 2 FORMATION</th>
                <th className="th-margin">FLIP MARGIN %</th>
                <th className="th-hl">DAY 2 HIGH / LOW</th>
                <th className="th-d1-details">DAY 1 (CLOSE / DATE)</th>
                <th className="th-date">DATE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="dd-empty-cell">
                    <div className="dd-loading-box">
                      <span className="dd-spinner">⏳</span>
                      <span>Calculating Bullish DD &amp; Bearish DD Structural Shifts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="dd-empty-cell">
                    <div className="dd-loading-box">
                      <span className="dd-spinner">📊</span>
                      <span>No stocks matched the selected DD pattern criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  return (
                    <tr
                      key={row.symbol || idx}
                      className={`dd-row ${row.isBullishDd ? "row-bullish" : row.isBearishDd ? "row-bearish" : ""}`}
                    >
                      <td className="td-sr">{idx + 1}</td>

                      {/* Ticker */}
                      <td className="td-sym">
                        <span
                          className="ticker-badge-link"
                          onClick={() => {
                            if (onOpenStrategy) {
                              onOpenStrategy({
                                symbol: row.symbol,
                                script: cleanSym,
                                timeframe,
                              });
                            } else if (onOpenPointer) {
                              onOpenPointer({
                                symbol: row.symbol,
                                script: cleanSym,
                                timeframe,
                              });
                            }
                          }}
                          title={`Open ${cleanSym} Strategy & Pointer Decision Matrix`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="td-price">
                        <strong>
                          ₹
                          {Number(row.price || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </td>

                      {/* DD Classification */}
                      <td className="td-type">
                        {row.isBullishDd && (
                          <span className="dd-badge badge-bullish">
                            🟢 BULLISH DD
                          </span>
                        )}
                        {row.isBearishDd && (
                          <span className="dd-badge badge-bearish">
                            🔴 BEARISH DD
                          </span>
                        )}
                        {!row.isBullishDd && !row.isBearishDd && (
                          <span className="dd-badge badge-neutral">
                            NO DD FLIP
                          </span>
                        )}
                      </td>

                      {/* Day 1 Formation */}
                      <td className="td-d1">
                        {row.day1State === "HLC LOWER" && (
                          <span className="state-tag tag-lower">
                            🔴 HLC LOWER
                          </span>
                        )}
                        {row.day1State === "HLC HIGHER" && (
                          <span className="state-tag tag-higher">
                            🟢 HLC HIGHER
                          </span>
                        )}
                        {row.day1State === "NEUTRAL" && (
                          <span className="state-tag tag-neutral">NEUTRAL</span>
                        )}
                      </td>

                      {/* Day 2 Formation */}
                      <td className="td-d2">
                        {row.day2State === "HLC HIGHER" && (
                          <span className="state-tag tag-higher">
                            🟢 HLC HIGHER
                          </span>
                        )}
                        {row.day2State === "HLC LOWER" && (
                          <span className="state-tag tag-lower">
                            🔴 HLC LOWER
                          </span>
                        )}
                        {row.day2State === "NEUTRAL" && (
                          <span className="state-tag tag-neutral">NEUTRAL</span>
                        )}
                      </td>

                      {/* Flip Margin % */}
                      <td className="td-margin">
                        {row.isBullishDd && (
                          <span className="margin-pill pill-bull">
                            +{row.margin}%
                          </span>
                        )}
                        {row.isBearishDd && (
                          <span className="margin-pill pill-bear">
                            -{row.margin}%
                          </span>
                        )}
                        {!row.isBullishDd && !row.isBearishDd && (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Day 2 High / Low */}
                      <td className="td-hl">
                        <div className="hl-stack">
                          <span className="high-txt">H: ₹{Number(row.high || 0).toFixed(2)}</span>
                          <span className="low-txt">L: ₹{Number(row.low || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* Day 1 (Close / Date) */}
                      <td className="td-d1-details">
                        <div className="d1-stack">
                          <span className="d1-close">₹{Number(row.day1Close || 0).toFixed(2)}</span>
                          <span className="d1-date">{row.day1Date || "—"}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="td-date">{row.date || "—"}</td>
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
