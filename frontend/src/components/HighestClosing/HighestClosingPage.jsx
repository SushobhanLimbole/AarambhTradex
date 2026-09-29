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
  const [timeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'ATH' | 'ATL' | 'CYATH' | 'CYATL' | 'TYPE1' | 'TYPE2'
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSymbol, setCopiedSymbol] = useState(null);

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    athCount: 0,
    atlCount: 0,
    cyathCount: 0,
    cyatlCount: 0,
    totalQualified: 0,
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
        console.warn("Meta load error in HighestClosingPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report (Triggered strictly on clicking RUN SCANNER)
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setHasScanned(true);
    setError("");
    try {
      const res = await highestClosingService.getHighestClosingReport({
        exchange,
        indice: indexVal,
        timeframe: "Daily", // strictly Daily
        actionDate: actionDate || undefined,
        filterType: "ALL",
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
  }, [exchange, indexVal, actionDate]);

  const filteredData = useMemo(() => {
    let list = reportData;
    const norm = String(filterType).toUpperCase();
    if (norm === "ATH") {
      list = list.filter((r) => r.isAthToday);
    } else if (norm === "ATL") {
      list = list.filter((r) => r.isAtlToday);
    } else if (norm === "CYATH") {
      list = list.filter((r) => r.isCyathToday);
    } else if (norm === "CYATL") {
      list = list.filter((r) => r.isCyatlToday);
    } else if (norm === "TYPE1") {
      list = list.filter((r) => r.isAthToday || r.isAtlToday);
    } else if (norm === "TYPE2") {
      list = list.filter((r) => r.isCyathToday || r.isCyatlToday);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((row) => {
      const sym = (row.symbol || "").toLowerCase();
      const cleanSym = (row.cleanSymbol || "").toLowerCase();
      return sym.includes(q) || cleanSym.includes(q);
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

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = [
      "SR.NO",
      "DATE",
      "TICKER NAME",
      "PRICE",
      "ATH VALUE",
      "ATH COUNT",
      "IS ATH TODAY",
      "ATL VALUE",
      "ATL COUNT",
      "IS ATL TODAY",
      "CYATH VALUE",
      "CYATH COUNT",
      "IS CYATH TODAY",
      "CYATL VALUE",
      "CYATL COUNT",
      "IS CYATL TODAY",
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      r.date,
      r.cleanSymbol || r.symbol,
      r.price,
      r.ath?.value ?? "—",
      r.ath?.count ?? 0,
      r.isAthToday ? "YES" : "NO",
      r.atl?.value ?? "—",
      r.atl?.count ?? 0,
      r.isAtlToday ? "YES" : "NO",
      r.cyath?.value ?? "—",
      r.cyath?.count ?? 0,
      r.isCyathToday ? "YES" : "NO",
      r.cyatl?.value ?? "—",
      r.cyatl?.count ?? 0,
      r.isCyatlToday ? "YES" : "NO",
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
      {/* 1. EXCEL SPECIFICATION MATRIX HEADER */}
      <div className="hc-matrix-card">
        <div className="hc-types-grid">
          {/* Type 1 Box: ATH Report */}
          <div
            className={`hc-type-box type-2-box ${filterType === "ATH" || filterType === "TYPE1" ? "active-type-box" : ""}`}
            onClick={() => setFilterType(filterType === "ATH" ? "ALL" : "ATH")}
          >
            <div className="hc-type-header-row">
              <span className="hc-type-tag tag-gold">Type 1: ATH Report</span>
              <span className="hc-filter-click-hint">Click to filter</span>
            </div>
            <div className="hc-type-title">All-Time High Report</div>
            <div className="hc-type-sub">
              Baseline established across the <strong>first 6 months</strong> of stock history. Compares every subsequent trading day against the rolling Lifetime ATH &amp; ATL closing thresholds.
            </div>
            <div className="hc-type-stats-row">
              <div className="hc-stat-pill stat-gold">
                <span className="stat-icon">👑</span>
                <span>ATH Today:</span>
                <strong>{summary.athCount || 0}</strong>
              </div>
              <div className="hc-stat-pill stat-red">
                <span className="stat-icon">🔻</span>
                <span>ATL Today:</span>
                <strong>{summary.atlCount || 0}</strong>
              </div>
            </div>
          </div>

          {/* Type 2 Box: CYATH Report */}
          <div
            className={`hc-type-box type-1-box ${filterType === "CYATH" || filterType === "TYPE2" ? "active-type-box" : ""}`}
            onClick={() => setFilterType(filterType === "CYATH" ? "ALL" : "CYATH")}
          >
            <div className="hc-type-header-row">
              <span className="hc-type-tag tag-cyan">Type 2: CYATH Report</span>
              <span className="hc-filter-click-hint">Click to filter</span>
            </div>
            <div className="hc-type-title">Current Year All-Time High Report</div>
            <div className="hc-type-sub">
              Baseline established across <strong>first 6 months of current year (Jan 1 – Jun 30)</strong>. Compares each subsequent day from Jul 1 onwards against the Current Year ATH &amp; ATL closing thresholds.
            </div>
            <div className="hc-type-stats-row">
              <div className="hc-stat-pill stat-cyan">
                <span className="stat-icon">🌟</span>
                <span>CYATH Today:</span>
                <strong>{summary.cyathCount || 0}</strong>
              </div>
              <div className="hc-stat-pill stat-amber">
                <span className="stat-icon">🔻</span>
                <span>CYATL Today:</span>
                <strong>{summary.cyatlCount || 0}</strong>
              </div>
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

        {/* Timeframe (Locked to Daily) */}
        <div className="hc-control-group">
          <label className="hc-label">Timeframe</label>
          <select
            className="hc-select locked-select"
            value={timeframe}
            disabled
            title="Highest Closing Report is evaluated exclusively on Daily timeframe"
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
            All Breakouts ({summary.totalQualified || 0})
          </button>

          <button
            type="button"
            className={`hc-pill-btn pill-gold ${filterType === "ATH" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "ATH" ? "ALL" : "ATH")}
          >
            👑 ATH ({summary.athCount || 0})
          </button>

          <button
            type="button"
            className={`hc-pill-btn pill-red ${filterType === "ATL" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "ATL" ? "ALL" : "ATL")}
          >
            🔻 ATL ({summary.atlCount || 0})
          </button>

          <button
            type="button"
            className={`hc-pill-btn pill-cyan ${filterType === "CYATH" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "CYATH" ? "ALL" : "CYATH")}
          >
            🌟 CYATH ({summary.cyathCount || 0})
          </button>

          <button
            type="button"
            className={`hc-pill-btn pill-amber ${filterType === "CYATL" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "CYATL" ? "ALL" : "CYATL")}
          >
            🔻 CYATL ({summary.cyatlCount || 0})
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
            Showing <strong>{filteredData.length}</strong> qualifying stocks for <strong>{actionDate || "Action Date"}</strong> (Scanned {summary.totalScanned || 0} stocks)
          </span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE (Columns: SR.NO, DATE, TICKER NAME, ATH, ATL, CYATH, CYATL, ACTIONS) */}
      <div className="hc-table-card">
        <div className="hc-table-scroll">
          <table className="hc-table">
            <thead>
              <tr>
                <th className="th-sr">SR.NO</th>
                <th className="th-date">DATE</th>
                <th className="th-sym">TICKER NAME</th>
                <th className="th-ath">ATH</th>
                <th className="th-atl">ATL</th>
                <th className="th-cyath">CYATH</th>
                <th className="th-cyatl">CYATL</th>
                <th className="th-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="hc-empty-cell">
                    <div className="hc-loading-box">
                      <span className="hc-spinner">⏳</span>
                      <span>Calculating 6-Month Baseline &amp; Threshold Crossers...</span>
                    </div>
                  </td>
                </tr>
              ) : !hasScanned ? (
                <tr>
                  <td colSpan={8} className="hc-empty-cell">
                    <div className="hc-loading-box">
                      <span className="hc-spinner">⚡</span>
                      <span>Select filters above and click <strong>&quot;RUN SCANNER&quot;</strong> to analyze stocks.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hc-empty-cell">
                    <div className="hc-loading-box">
                      <span className="hc-spinner">📊</span>
                      <span>No stocks crossed an ATH, ATL, CYATH, or CYATL threshold on {actionDate || "this date"}.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const cleanSym = row.cleanSymbol || stripSymbolSuffix(row.symbol);
                  return (
                    <tr
                      key={row.symbol || idx}
                      className={`hc-row ${row.isAthToday ? "row-ath-today" : row.isCyathToday ? "row-cyath-today" : ""}`}
                    >
                      {/* 1. SR.NO */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* 2. DATE */}
                      <td className="td-date">
                        <span className="date-badge">{row.date}</span>
                      </td>

                      {/* 3. TICKER NAME */}
                      <td className="td-sym">
                        <div className="ticker-cell">
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
                          <span className="price-sub">₹{Number(row.price || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* 4. ATH (Lifetime All Time High) */}
                      <td className="td-ath">
                        {row.ath?.value ? (
                          <div className={`threshold-badge ${row.isAthToday ? "badge-today badge-gold" : "badge-inactive"}`}>
                            {row.isAthToday && <span className="today-icon">👑</span>}
                            <span className="threshold-val">₹{Number(row.ath.value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="count-pill">Count: {row.ath.count}</span>
                          </div>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>

                      {/* 5. ATL (Lifetime All Time Low) */}
                      <td className="td-atl">
                        {row.atl?.value ? (
                          <div className={`threshold-badge ${row.isAtlToday ? "badge-today badge-red" : "badge-inactive"}`}>
                            {row.isAtlToday && <span className="today-icon">🔻</span>}
                            <span className="threshold-val">₹{Number(row.atl.value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="count-pill">Count: {row.atl.count}</span>
                          </div>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>

                      {/* 6. CYATH (Current Year All Time High) */}
                      <td className="td-cyath">
                        {row.cyath?.value ? (
                          <div className={`threshold-badge ${row.isCyathToday ? "badge-today badge-cyan" : "badge-inactive"}`}>
                            {row.isCyathToday && <span className="today-icon">🌟</span>}
                            <span className="threshold-val">₹{Number(row.cyath.value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="count-pill">Count: {row.cyath.count}</span>
                          </div>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>

                      {/* 7. CYATL (Current Year All Time Low) */}
                      <td className="td-cyatl">
                        {row.cyatl?.value ? (
                          <div className={`threshold-badge ${row.isCyatlToday ? "badge-today badge-amber" : "badge-inactive"}`}>
                            {row.isCyatlToday && <span className="today-icon">🔻</span>}
                            <span className="threshold-val">₹{Number(row.cyatl.value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="count-pill">Count: {row.cyatl.count}</span>
                          </div>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>

                      {/* 8. ACTIONS */}
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
