import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./HighestClosingPage.css";
import highestClosingService from "../../services/highestClosingService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

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

export default function HighestClosingPage({ onOpenStrategy, onOpenPointer, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'LIFETIME' | 'FROM_1_JAN_2026' | 'NEAR_HIGH'
  const [searchQuery, setSearchQuery] = useState("");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    lifetimeAthCount: 0,
    ytdHighestCount: 0,
    nearHighCount: 0,
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
        console.warn("Meta load error in HighestClosingPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await highestClosingService.getHighestClosingReport({
        exchange,
        indice: indexVal,
        timeframe: "Daily", // strictly Daily
        actionDate: actionDate || undefined,
        filterType,
        ytdStartDate: "2026-01-01",
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
      console.error("Highest Closing Report Error:", err);
      setError(err.message || "Failed to load Highest Closing report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, actionDate, filterType]);

  useEffect(() => {
    handleFetchReport();
  }, [handleFetchReport]);

  const filteredData = useMemo(() => {
    return reportData.filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sym = (row.symbol || "").toLowerCase();
      const cat = (row.recordType || "").toLowerCase();
      const badge = (row.badgeLabel || "").toLowerCase();
      return sym.includes(q) || cat.includes(q) || badge.includes(q);
    });
  }, [reportData, searchQuery]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = [
      "SR",
      "Symbol",
      "Price",
      "High",
      "Low",
      "Classification",
      "Lifetime Max Close",
      "Lifetime Max Date",
      "Delta from ATH %",
      "2026 YTD Max Close",
      "2026 YTD Max Date",
      "Delta from 2026 %",
      "Candle Date",
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      r.symbol,
      r.price,
      r.high,
      r.low,
      `"${r.recordType}"`,
      r.lifetimeMaxClose,
      r.lifetimeMaxDate,
      `${r.deltaFromAthPercent}%`,
      r.ytdMaxClose,
      r.ytdMaxDate,
      `${r.deltaFromYtdPercent}%`,
      r.date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `highest_closing_report_${actionDate || "latest"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="hc-report-wrapper">
      {/* 1. EXCEL SPECIFICATION MATRIX HEADER (MATCHING USER IMAGE PRECISELY) */}
      <div className="hc-matrix-card">
        {/* Top Types Banner */}
        <div className="hc-types-grid">
          {/* Type 1 Box */}
          <div className="hc-type-box type-1-box">
            <div className="hc-type-tag">type 1</div>
            <div className="hc-type-title">highest closing from 1 jan 2026</div>
            <div className="hc-type-sub">
              Current closing price is greater than or equal to all daily closes recorded since <strong>01-Jan-2026</strong>.
            </div>
            <div className="hc-type-stat">
              <span className="hc-stat-label">Matching Stocks:</span>
              <span className="hc-stat-value val-cyan">{summary.ytdHighestCount || 0}</span>
            </div>
          </div>

          {/* Type 2 Box */}
          <div className="hc-type-box type-2-box">
            <div className="hc-type-tag tag-gold">type 2</div>
            <div className="hc-type-title">highest closing from life time</div>
            <div className="hc-type-sub">
              Current closing price is at an <strong>All-Time High (ATH)</strong> across the entire lifetime dataset.
            </div>
            <div className="hc-type-stat">
              <span className="hc-stat-label">Matching Stocks:</span>
              <span className="hc-stat-value val-gold">{summary.lifetimeAthCount || 0}</span>
            </div>
          </div>
        </div>

        {/* GOLD RIBBON: ONLY DAILY TIME FRAME */}
        <div className="hc-gold-ribbon">
          <div className="hc-ribbon-content">
            <span className="hc-ribbon-badge">ONLY DAILY TIME FRAME</span>
            <span className="hc-ribbon-desc">
              Institutional benchmark closing scanner evaluated exclusively across End-of-Day (EOD) daily candle closes.
            </span>
          </div>
          <div className="hc-ribbon-stats">
            <div className="hc-stat-chip">
              <span className="chip-label">👑 Lifetime ATH Closes:</span>
              <span className="chip-val text-gold">{summary.lifetimeAthCount || 0}</span>
            </div>
            <div className="hc-stat-chip">
              <span className="chip-label">🌟 2026 Peak Closes:</span>
              <span className="chip-val text-cyan">{summary.ytdHighestCount || 0}</span>
            </div>
            <div className="hc-stat-chip">
              <span className="chip-label">⚡ Within 3% of Peak:</span>
              <span className="chip-val text-yellow">{summary.nearHighCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR */}
      <div className="hc-toolbar">
        {onBack && (
          <button
            type="button"
            className="hc-back-btn"
            onClick={onBack}
            title="Return to 8 Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* Exchange */}
        <div className="hc-control-group">
          <label className="hc-label">Exchange</label>
          <select
            className="hc-select"
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
        <div className="hc-control-group hc-wide">
          <label className="hc-label">Index</label>
          <select
            className="hc-select"
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

        {/* Timeframe (Locked to Daily as specified) */}
        <div className="hc-control-group">
          <label className="hc-label">Timeframe</label>
          <select
            className="hc-select locked-select"
            value={timeframe}
            disabled
            title="Highest Closing Report is restricted to ONLY DAILY TIME FRAME"
          >
            <option value="Daily">Daily (Locked)</option>
          </select>
        </div>

        {/* Action Date */}
        <div className="hc-control-group">
          <label className="hc-label">Action Date</label>
          <input
            type="date"
            className="hc-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="hc-filter-pills">
          <button
            type="button"
            className={`hc-pill-btn ${filterType === "ALL" ? "active" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All Stocks ({summary.totalScanned})
          </button>
          <button
            type="button"
            className={`hc-pill-btn pill-gold ${filterType === "LIFETIME" ? "active" : ""}`}
            onClick={() => setFilterType("LIFETIME")}
          >
            👑 Lifetime ATH ({summary.lifetimeAthCount})
          </button>
          <button
            type="button"
            className={`hc-pill-btn pill-cyan ${filterType === "FROM_1_JAN_2026" ? "active" : ""}`}
            onClick={() => setFilterType("FROM_1_JAN_2026")}
          >
            🌟 From 1 Jan 2026 ({summary.ytdHighestCount})
          </button>
          <button
            type="button"
            className={`hc-pill-btn pill-near ${filterType === "NEAR_HIGH" ? "active" : ""}`}
            onClick={() => setFilterType("NEAR_HIGH")}
          >
            ⚡ Near Peak &lt;3% ({summary.nearHighCount})
          </button>
        </div>

        {/* Actions */}
        <button
          type="button"
          className="hc-run-btn"
          onClick={handleFetchReport}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN SCANNER"}
        </button>

        <button
          type="button"
          className="hc-export-btn"
          onClick={handleExportCSV}
          disabled={!filteredData.length}
          title="Export table to CSV"
        >
          📥 CSV
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="hc-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 3. SEARCH & TABLE STATS BAR */}
      <div className="hc-search-bar-row">
        <div className="hc-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker symbol (e.g. RELIANCE, TCS, INFY)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hc-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="hc-table-counts">
          <span>
            Showing <strong>{filteredData.length}</strong> of <strong>{reportData.length}</strong> stocks
          </span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE */}
      <div className="hc-table-card">
        <div className="hc-table-scroll">
          <table className="hc-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th className="th-sym">TICKER</th>
                <th className="th-price">PRICE (CLOSE)</th>
                <th className="th-hl">DAY HIGH / LOW</th>
                <th className="th-type">RECORD TYPE</th>
                <th className="th-lt-max">LIFETIME MAX CLOSE</th>
                <th className="th-lt-delta">DELTA FROM ATH</th>
                <th className="th-ytd-max">2026 PEAK CLOSE</th>
                <th className="th-ytd-delta">DELTA FROM 2026</th>
                <th className="th-date">DATE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="hc-empty-cell">
                    <div className="hc-loading-box">
                      <span className="hc-spinner">⏳</span>
                      <span>Calculating Lifetime &amp; 2026 YTD Highest Closing Matrices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="hc-empty-cell">
                    <div className="hc-loading-box">
                      <span className="hc-spinner">📊</span>
                      <span>No stocks matched the selected Highest Closing criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  return (
                    <tr key={row.symbol || idx} className={`hc-row ${row.isLifetimeAth ? "row-lifetime" : row.isYtdHighest ? "row-ytd" : ""}`}>
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
                                timeframe: "Daily",
                              });
                            } else if (onOpenPointer) {
                              onOpenPointer({
                                symbol: row.symbol,
                                script: cleanSym,
                                timeframe: "Daily",
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

                      {/* High / Low */}
                      <td className="td-hl">
                        <div className="hl-box">
                          <span className="high-val">H: ₹{Number(row.high || 0).toFixed(2)}</span>
                          <span className="low-val">L: ₹{Number(row.low || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* Record Type */}
                      <td className="td-type">
                        {row.isLifetimeAth && (
                          <span className="hc-badge badge-lifetime">
                            👑 TYPE 2: LIFETIME ATH
                          </span>
                        )}
                        {!row.isLifetimeAth && row.isYtdHighest && (
                          <span className="hc-badge badge-ytd">
                            🌟 TYPE 1: 1 JAN 2026 PEAK
                          </span>
                        )}
                        {!row.isLifetimeAth && !row.isYtdHighest && row.isNearHigh && (
                          <span className="hc-badge badge-near">
                            ⚡ WITHIN 3% OF PEAK
                          </span>
                        )}
                        {!row.isLifetimeAth && !row.isYtdHighest && !row.isNearHigh && (
                          <span className="hc-badge badge-standard">
                            REGULAR CLOSE
                          </span>
                        )}
                      </td>

                      {/* Lifetime Max Close */}
                      <td className="td-lt-max">
                        <div className="max-box">
                          <span className="max-price">₹{Number(row.lifetimeMaxClose || 0).toFixed(2)}</span>
                          <span className="max-date">{row.lifetimeMaxDate || "—"}</span>
                        </div>
                      </td>

                      {/* Delta From ATH */}
                      <td className="td-lt-delta">
                        {row.deltaFromAthPercent >= 0 ? (
                          <span className="delta-tag tag-ath">ATH (0.00%)</span>
                        ) : (
                          <span className={`delta-tag ${Math.abs(row.deltaFromAthPercent) <= 3 ? "tag-near" : "tag-neg"}`}>
                            {row.deltaFromAthPercent}%
                          </span>
                        )}
                      </td>

                      {/* 2026 Max Close */}
                      <td className="td-ytd-max">
                        <div className="max-box">
                          <span className="max-price">₹{Number(row.ytdMaxClose || 0).toFixed(2)}</span>
                          <span className="max-date">{row.ytdMaxDate || "—"}</span>
                        </div>
                      </td>

                      {/* Delta From YTD */}
                      <td className="td-ytd-delta">
                        {row.deltaFromYtdPercent >= 0 ? (
                          <span className="delta-tag tag-ytd-peak">PEAK (0.00%)</span>
                        ) : (
                          <span className={`delta-tag ${Math.abs(row.deltaFromYtdPercent) <= 3 ? "tag-near" : "tag-neg"}`}>
                            {row.deltaFromYtdPercent}%
                          </span>
                        )}
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
