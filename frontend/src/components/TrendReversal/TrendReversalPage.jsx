import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./TrendReversalPage.css";
import trendReversalService from "../../services/trendReversalService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

const TIMEFRAMES = ["Monthly", "Daily", "Weekly", "Quarterly", "Half-Yearly", "Yearly"];

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

export default function TrendReversalPage({ onOpenStrategy, onOpenPointer, onOpenStockAnalytics, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [reversalType, setReversalType] = useState("ALL"); // 'ALL' | 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // 'sr' | 'date' | 'ticker' | 'currStatus' | 'zone'
  const [sortOrder, setSortOrder] = useState("desc");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    bullishReversals: 0,
    bearishReversals: 0,
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
        console.warn("Meta load error in TrendReversalPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await trendReversalService.getTrendReversalReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: actionDate || undefined,
        reversalType,
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
      console.error("Trend Reversal Error:", err);
      setError(err.message || "Failed to load Trend Reversal report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate, reversalType]);

  useEffect(() => {
    handleFetchReport();
  }, [handleFetchReport]);

  // Handle header sort
  const handleHeaderSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder(columnKey === "date" ? "desc" : "asc");
    }
  };

  // Filter and sort processed rows
  const processedData = useMemo(() => {
    let list = [...reportData];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((row) => {
        const sym = stripSymbolSuffix(row.symbol).toLowerCase();
        const dt = String(row.date || "").toLowerCase();
        const st = String(row.currStatus || row.runningTrend || "").toLowerCase();
        const zn = String(row.zone || "").toLowerCase();
        return sym.includes(q) || dt.includes(q) || st.includes(q) || zn.includes(q);
      });
    }

    list.sort((a, b) => {
      let comp = 0;
      if (sortBy === "date") {
        const tA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const tB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        comp = tB - tA;
        if (comp === 0) comp = a.symbol.localeCompare(b.symbol);
        return sortOrder === "asc" ? -comp : comp;
      } else if (sortBy === "ticker") {
        comp = a.symbol.localeCompare(b.symbol);
      } else if (sortBy === "currStatus") {
        comp = String(a.currStatus || a.runningTrend || "").localeCompare(String(b.currStatus || b.runningTrend || ""));
      } else if (sortBy === "zone") {
        comp = String(a.zone || "").localeCompare(String(b.zone || ""));
      }
      return sortOrder === "asc" ? comp : -comp;
    });

    return list;
  }, [reportData, searchQuery, sortBy, sortOrder]);

  // Click on stock routes directly to Data Summary / Analytics page
  const handleStockClick = (row) => {
    const cleanSym = stripSymbolSuffix(row.symbol);
    if (onOpenStockAnalytics) {
      onOpenStockAnalytics({
        symbol: row.symbol,
        exchange: row.exchange || exchange || "NSE",
        indice: indexVal || "ALL",
        timeframe: timeframe || "Daily",
      });
    } else if (onOpenStrategy) {
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
  };

  return (
    <div className="trend-reversal-wrapper">
      {/* 1. FILTER CONTROLS TOOLBAR */}
      <div className="tr-toolbar">
        {onBack && (
          <button
            type="button"
            className="tr-back-btn"
            onClick={onBack}
            title="Return to Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* Exchange */}
        <div className="tr-control-group">
          <label className="tr-label">Exchange</label>
          <select
            className="tr-select"
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
        <div className="tr-control-group tr-wide">
          <label className="tr-label">Index</label>
          <select
            className="tr-select"
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
        <div className="tr-control-group">
          <label className="tr-label">Timeframe</label>
          <select
            className="tr-select"
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
        <div className="tr-control-group">
          <label className="tr-label">Action Date</label>
          <input
            type="date"
            className="tr-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* Run Scan Button */}
        <button
          type="button"
          className="tr-run-btn"
          onClick={handleFetchReport}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN SCANNER"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="tr-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 2. SEARCH & TABLE STATS */}
      <div className="tr-search-bar-row">
        <div className="tr-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker symbol (e.g. RELIANCE, TCS, INFY)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tr-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="tr-table-counts">
          <span>Showing <strong>{processedData.length}</strong> of <strong>{reportData.length}</strong> stocks</span>
        </div>
      </div>

      {/* 3. DATA TABLE (5 COLUMNS: Sr | date | ticker | Curr status | zone) */}
      <div className="tr-table-card">
        <div className="tr-table-scroll">
          <table className="tr-table">
            <thead>
              <tr>
                <th className="th-sr">Sr</th>
                <th
                  className="th-date sortable-th"
                  onClick={() => handleHeaderSort("date")}
                  title="Click to sort by date"
                >
                  date {sortBy === "date" && (sortOrder === "desc" ? "▼" : "▲")}
                </th>
                <th
                  className="th-ticker sortable-th"
                  onClick={() => handleHeaderSort("ticker")}
                  title="Click to sort by ticker"
                >
                  ticker {sortBy === "ticker" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-status sortable-th"
                  onClick={() => handleHeaderSort("currStatus")}
                  title="Click to sort by status"
                >
                  Curr status {sortBy === "currStatus" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-zone sortable-th"
                  onClick={() => handleHeaderSort("zone")}
                  title="Click to sort by zone"
                >
                  zone {sortBy === "zone" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="tr-empty-cell">
                    <div className="tr-loading-box">
                      <span className="tr-spinner">⏳</span>
                      <span>Calculating Trend Reversal Matrices...</span>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tr-empty-cell">
                    <div className="tr-loading-box">
                      <span className="tr-spinner">📊</span>
                      <span>No stocks matched the selected criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  const isHigher = row.currStatus === "HLC HIGHER" || row.runningTrend?.includes("HIGHER");
                  const isLower = row.currStatus === "HLC LOWER" || row.runningTrend?.includes("LOWER");
                  const isGreen = row.zone === "GREEN" || row.isBullishReversal;
                  const isRed = row.zone === "RED" || row.isBearishReversal;

                  return (
                    <tr key={row.symbol || idx} className="tr-row">
                      {/* 1. Sr */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* 2. date */}
                      <td className="td-date">{row.date || "—"}</td>

                      {/* 3. ticker */}
                      <td className="td-sym">
                        <span
                          className="ticker-badge-link"
                          onClick={() => handleStockClick(row)}
                          title={`Click to open ${cleanSym} Data Summary & Analytics`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* 4. Curr status (hlc higher / lower) */}
                      <td className="td-status">
                        {isHigher && (
                          <span className="running-badge run-green">HLC HIGHER</span>
                        )}
                        {isLower && (
                          <span className="running-badge run-red">HLC LOWER</span>
                        )}
                        {!isHigher && !isLower && <span className="tr-muted">—</span>}
                      </td>

                      {/* 5. zone (green / red) */}
                      <td className="td-zone">
                        {isGreen && (
                          <span className="zone-pill zone-green">
                            🟢 GREEN
                          </span>
                        )}
                        {isRed && (
                          <span className="zone-pill zone-red">
                            🔴 RED
                          </span>
                        )}
                        {!isGreen && !isRed && (
                          <span className="zone-pill zone-neutral">
                            ⚪ —
                          </span>
                        )}
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
