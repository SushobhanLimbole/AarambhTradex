import React, { useState, useEffect, useCallback } from "react";
import "./CbReportPage.css";
import cbReportService from "../../services/cbReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

const TIMEFRAMES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

// Preset indices matching screenshot with exact formatting
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

export default function CbReportPage({ onOpenStrategy, onOpenPointer, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'CB_WITH_STATUS' | 'ORDINARY_CB' | 'BULLISH' | 'BEARISH'
  const [searchQuery, setSearchQuery] = useState("");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    ordinaryBullishCb: 0,
    bullishCbWithStatus: 0,
    ordinaryBearishCb: 0,
    bearishCbWithStatus: 0,
    totalScanned: 0,
    backtest: {
      overallAccuracy: 0,
      bullishAccuracy: 0,
      bearishAccuracy: 0,
      bullHits: 0,
      bullTotal: 0,
      bearHits: 0,
      bearTotal: 0,
    },
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
        console.warn("Meta load error in CbReportPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await cbReportService.getCbReport({
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
      console.error("CB Report Error:", err);
      setError(err.message || "Failed to load CB report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate, filterType]);

  useEffect(() => {
    handleFetchReport();
  }, [handleFetchReport]);

  const filteredData = reportData.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const sym = (row.symbol || "").toLowerCase();
    const type = (row.cbType || "").toLowerCase();
    const status = (row.statusBadge || "").toLowerCase();
    return sym.includes(q) || type.includes(q) || status.includes(q);
  });

  return (
    <div className="cb-report-wrapper">
      {/* 1. EXCEL SPECIFICATION MATRIX HEADER (MATCHING USER SCREENSHOT EXACTLY) */}
      <div className="cb-matrix-card">
        {/* Top Type Headers */}
        <div className="cb-type-banner-row">
          <div className="cb-type-col">
            <span className="type-badge">TYPE 1</span>
            <span className="type-desc">ORDINARY CB</span>
          </div>
          <div className="cb-type-col">
            <span className="type-badge">TYPE 2</span>
            <span className="type-desc highlight">CB WITH STATUS</span>
          </div>
          <div className="cb-type-col right-align">
            <span className="cb-scope-pill">FOR ALL TIME FRAME</span>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="cb-matrix-grid">
          {/* BULLISH SECTION (GREEN) */}
          <div className="cb-matrix-section section-green">
            <div className="section-header-row header-green">
              <span className="sec-title">ORDINARY CB (BULLISH)</span>
              <span className="sec-title highlight">CB WITH STATUS (BULLISH)</span>
            </div>

            <div className="cb-formula-grid">
              <div className="cb-formula-col">
                <div className="day-step">
                  <span className="day-num">DAY 1</span>
                  <span className="day-math">CLOSE &gt; SAME DAY AVG</span>
                </div>
                <div className="day-step">
                  <span className="day-num">DAY 2</span>
                  <span className="day-math">CLOSE &gt; PREV.HIGH</span>
                </div>
              </div>

              <div className="cb-formula-col col-status">
                <div className="day-step">
                  <span className="day-num">DAY 1</span>
                  <span className="day-math">CLOSE &gt; SAME DAY AVG</span>
                </div>
                <div className="day-step">
                  <span className="day-num">DAY 2</span>
                  <span className="day-math">CLOSE &gt; PREV.HIGH</span>
                </div>
                <div className="status-callout-box callout-green">
                  <span>ON DAY 2 HLC HIGHER FORMED</span>
                </div>
              </div>
            </div>

            {/* Bullish Counters */}
            <div className="cb-counter-footer">
              <div className="cb-cnt-box">
                <span className="cb-cnt-lbl">Ordinary Bullish CB:</span>
                <span className="cb-cnt-val val-green">{summary.ordinaryBullishCb || 0}</span>
              </div>
              <div className="cb-cnt-box highlight-box">
                <span className="cb-cnt-lbl">Bullish CB with Status:</span>
                <span className="cb-cnt-val val-green">{summary.bullishCbWithStatus || 0}</span>
              </div>
            </div>
          </div>

          {/* BEARISH SECTION (RED) */}
          <div className="cb-matrix-section section-red">
            <div className="section-header-row header-red">
              <span className="sec-title">ORDINARY CB (BEARISH)</span>
              <span className="sec-title highlight">CB WITH STATUS (BEARISH)</span>
            </div>

            <div className="cb-formula-grid">
              <div className="cb-formula-col">
                <div className="day-step">
                  <span className="day-num">DAY 1</span>
                  <span className="day-math">CLOSE &lt; SAME DAY AVG</span>
                </div>
                <div className="day-step">
                  <span className="day-num">DAY 2</span>
                  <span className="day-math">CLOSE &lt; PREV.LOW</span>
                </div>
              </div>

              <div className="cb-formula-col col-status">
                <div className="day-step">
                  <span className="day-num">DAY 1</span>
                  <span className="day-math">CLOSE &lt; SAME DAY AVG</span>
                </div>
                <div className="day-step">
                  <span className="day-num">DAY 2</span>
                  <span className="day-math">CLOSE &lt; PREV.LOW</span>
                </div>
                <div className="status-callout-box callout-red">
                  <span>ON DAY 2 HLC LOWER FORMED</span>
                </div>
              </div>
            </div>

            {/* Bearish Counters */}
            <div className="cb-counter-footer">
              <div className="cb-cnt-box">
                <span className="cb-cnt-lbl">Ordinary Bearish CB:</span>
                <span className="cb-cnt-val val-red">{summary.ordinaryBearishCb || 0}</span>
              </div>
              <div className="cb-cnt-box highlight-box">
                <span className="cb-cnt-lbl">Bearish CB with Status:</span>
                <span className="cb-cnt-val val-red">{summary.bearishCbWithStatus || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* GOLD RIBBON: BACKTESTING WITH ACCURACY IN % */}
        <div className="cb-backtest-ribbon">
          <div className="cb-ribbon-left">
            <span className="ribbon-icon">🏆</span>
            <span className="ribbon-title">BACKTESTING THIS REPORT WITH ACCURACY IN %</span>
          </div>
          <div className="cb-ribbon-stats">
            <div className="cb-stat-pill">
              <span className="lbl">Overall Accuracy:</span>
              <span className="val highlight">{summary.backtest?.overallAccuracy || 0}%</span>
            </div>
            <div className="cb-stat-pill">
              <span className="lbl">Bullish Breakouts:</span>
              <span className="val text-bull">{summary.backtest?.bullishAccuracy || 0}%</span>
            </div>
            <div className="cb-stat-pill">
              <span className="lbl">Bearish Breakdowns:</span>
              <span className="val text-bear">{summary.backtest?.bearishAccuracy || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR */}
      <div className="cb-toolbar">
        {onBack && (
          <button
            type="button"
            className="cb-back-btn"
            onClick={onBack}
            title="Return to 8 Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* Exchange */}
        <div className="cb-control-group">
          <label className="cb-label">Exchange</label>
          <select
            className="cb-select"
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
        <div className="cb-control-group cb-wide">
          <label className="cb-label">Index</label>
          <select
            className="cb-select"
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
        <div className="cb-control-group">
          <label className="cb-label">Timeframe</label>
          <select
            className="cb-select"
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
        <div className="cb-control-group">
          <label className="cb-label">Action Date</label>
          <input
            type="date"
            className="cb-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="cb-filter-pills">
          <button
            type="button"
            className={`cb-pill-btn ${filterType === "ALL" ? "active" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All Stocks ({summary.totalScanned})
          </button>
          <button
            type="button"
            className={`cb-pill-btn pill-status ${filterType === "CB_WITH_STATUS" ? "active" : ""}`}
            onClick={() => setFilterType("CB_WITH_STATUS")}
          >
            CB with Status ({summary.bullishCbWithStatus + summary.bearishCbWithStatus})
          </button>
          <button
            type="button"
            className={`cb-pill-btn pill-bullish ${filterType === "BULLISH" ? "active" : ""}`}
            onClick={() => setFilterType("BULLISH")}
          >
            Bullish CB ({summary.ordinaryBullishCb})
          </button>
          <button
            type="button"
            className={`cb-pill-btn pill-bearish ${filterType === "BEARISH" ? "active" : ""}`}
            onClick={() => setFilterType("BEARISH")}
          >
            Bearish CB ({summary.ordinaryBearishCb})
          </button>
        </div>

        {/* Run Scan Button */}
        <button
          type="button"
          className="cb-run-btn"
          onClick={handleFetchReport}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN SCANNER"}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="cb-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 3. SEARCH & SUMMARY BAR */}
      <div className="cb-search-bar-row">
        <div className="cb-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker symbol (e.g. RELIANCE, TCS, INFY)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cb-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="cb-table-counts">
          <span>Showing <strong>{filteredData.length}</strong> of <strong>{reportData.length}</strong> stocks</span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE */}
      <div className="cb-table-card">
        <div className="cb-table-scroll">
          <table className="cb-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th className="th-sym">TICKER</th>
                <th className="th-price">PRICE (CMP)</th>
                <th className="th-type">CB TYPE</th>
                <th className="th-status">STATUS FORMATION</th>
                <th className="th-day1">DAY 1 (PREV CLOSE vs AVG)</th>
                <th className="th-day2">DAY 2 (CLOSE vs PREV LEVEL)</th>
                <th className="th-margin">BREAKOUT MARGIN %</th>
                <th className="th-date">DATE</th>
                <th className="th-acc">HISTORICAL ACCURACY</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="cb-empty-cell">
                    <div className="cb-loading-box">
                      <span className="cb-spinner">⏳</span>
                      <span>Calculating CB (Ordinary &amp; CB with Status) Matrices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="cb-empty-cell">
                    <div className="cb-loading-box">
                      <span className="cb-spinner">📊</span>
                      <span>No stocks matched the selected CB criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  return (
                    <tr key={row.symbol || idx} className="cb-row">
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
                        <strong>₹{Number(row.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </td>

                      {/* CB Type */}
                      <td className="td-type">
                        {row.cbType === "CB WITH STATUS" && (
                          <span className={`cb-type-badge ${row.isBullish ? "badge-status-green" : "badge-status-red"}`}>
                            ⭐ CB WITH STATUS
                          </span>
                        )}
                        {row.cbType === "ORDINARY CB" && (
                          <span className={`cb-type-badge ${row.isBullish ? "badge-ord-green" : "badge-ord-red"}`}>
                            ORDINARY CB
                          </span>
                        )}
                        {row.cbType === "NO CB" && <span className="cb-muted">—</span>}
                      </td>

                      {/* Status Formation */}
                      <td className="td-status">
                        {row.isBullishCbWithStatus && (
                          <span className="status-pill pill-hlc-higher">
                            🟢 ON DAY 2 HLC HIGHER FORMED
                          </span>
                        )}
                        {row.isBearishCbWithStatus && (
                          <span className="status-pill pill-hlc-lower">
                            🔴 ON DAY 2 HLC LOWER FORMED
                          </span>
                        )}
                        {!row.isBullishCbWithStatus && !row.isBearishCbWithStatus && (
                          <span className="status-pill pill-standard">
                            {row.statusBadge || "STANDARD BREAKOUT"}
                          </span>
                        )}
                      </td>

                      {/* Day 1 */}
                      <td className="td-day1">
                        <div className="step-info-box">
                          <span>Close: ₹{row.prevClose}</span>
                          <span>Avg: ₹{row.prevAvg}</span>
                        </div>
                      </td>

                      {/* Day 2 */}
                      <td className="td-day2">
                        <div className="step-info-box">
                          <span>Close: <strong>₹{row.price}</strong></span>
                          <span>{row.isBullish ? `Prev High: ₹${row.prevHigh}` : `Prev Low: ₹${row.prevLow}`}</span>
                        </div>
                      </td>

                      {/* Breakout Margin */}
                      <td className="td-margin">
                        {row.isBullish && <span className="margin-tag tag-bull">+{row.breakoutMargin}%</span>}
                        {row.isBearish && <span className="margin-tag tag-bear">-{row.breakoutMargin}%</span>}
                        {!row.isBullish && !row.isBearish && <span className="cb-muted">—</span>}
                      </td>

                      {/* Date */}
                      <td className="td-date">{row.date || "—"}</td>

                      {/* Accuracy */}
                      <td className="td-acc">
                        <span className="acc-badge">{row.accuracy || 87}%</span>
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
