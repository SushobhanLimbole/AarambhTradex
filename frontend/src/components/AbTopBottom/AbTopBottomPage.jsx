import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./AbTopBottomPage.css";
import abTopBottomService from "../../services/abTopBottomService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { getConditionalActionDate } from "../../utils/dateUtils.js";
import SearchableSelect from "../Common/SearchableSelect.jsx";

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

export default function AbTopBottomPage({
  onOpenStockAnalytics,
  onOpenStrategy,
  onOpenPointer,
  onBack,
}) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily"); // Default Daily
  const [actionDate, setActionDate] = useState(() => getConditionalActionDate());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // 'sr' | 'date' | 'ticker' | 'scenario' | 'cmp'
  const [sortOrder, setSortOrder] = useState("desc");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    closingAboveAbTop: 0,
    closingBelowAbBottom: 0,
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
        console.warn("Meta load error in AbTopBottomPage:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch Report
  const handleFetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await abTopBottomService.getAbTopBottomReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: actionDate || undefined,
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
        setSummary({ closingAboveAbTop: 0, closingBelowAbBottom: 0, totalScanned: 0 });
      }
    } catch (err) {
      console.error("AB Top Bottom Error:", err);
      setError(err.message || "Failed to load Top & Bottom Extreme Zone report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate]);

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

  // Filter and sort data
  const processedData = useMemo(() => {
    let list = [...reportData];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const sym = stripSymbolSuffix(r.symbol).toLowerCase();
        const sc = String(r.scenario || "").toLowerCase();
        const dt = String(r.date || "").toLowerCase();
        return sym.includes(q) || sc.includes(q) || dt.includes(q);
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
      } else if (sortBy === "scenario") {
        comp = String(a.scenario || "").localeCompare(String(b.scenario || ""));
      } else if (sortBy === "cmp") {
        comp = (Number(a.cmp) || 0) - (Number(b.cmp) || 0);
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
    <div className="ab-top-bottom-wrapper">
      {/* 1. TOP HEADER SUMMARY MATRIX */}
      <div className="ab-matrix-card">
        <div className="ab-matrix-grid-simple">
          <div className="ab-metric-row">
            <span className="ab-metric-label">EXTREME AB TOP</span>
            <div className="ab-value-box box-red">
              <span className="ab-val-num">{summary.closingAboveAbTop || 0}</span>
            </div>
          </div>

          <div className="ab-metric-row">
            <span className="ab-metric-label">EXTREME AB BOTTOM</span>
            <div className="ab-value-box box-green">
              <span className="ab-val-num">{summary.closingBelowAbBottom || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR */}
      <div className="ab-toolbar">
        {onBack && (
          <button
            type="button"
            className="ab-back-btn"
            onClick={onBack}
            title="Return to Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* Exchange */}
        <div className="ab-control-group">
          <label className="ab-label">Exchange</label>
          <SearchableSelect
            options={[{ value: "ALL", label: "ALL" }, ...availableExchanges.map((ex) => ({ value: ex, label: ex }))]}
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            compact
          />
        </div>

        {/* Index */}
        <div className="ab-control-group ab-wide">
          <label className="ab-label">Index</label>
          <SearchableSelect
            options={[{ value: "ALL", label: "ALL (All Stocks)" }, ...indexOptions]}
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
            compact
          />
        </div>

        {/* Timeframe */}
        <div className="ab-control-group">
          <label className="ab-label">Timeframe</label>
          <SearchableSelect
            options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            compact
          />
        </div>

        {/* Action Date */}
        <div className="ab-control-group">
          <label className="ab-label">Action Date</label>
          <input
            type="date"
            className="ab-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* Scan Button */}
        <button
          type="button"
          className="ab-run-btn"
          onClick={handleFetchReport}
          disabled={loading}
        >
          {loading ? "Scanning..." : "RUN SCANNER"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="ab-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 3. SEARCH & SUMMARY BAR */}
      <div className="ab-search-bar-row">
        <div className="ab-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker symbol (e.g. RELIANCE, TCS, INFOSYS)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ab-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="ab-table-counts">
          <span>Showing <strong>{processedData.length}</strong> of <strong>{reportData.length}</strong> extreme zone signals</span>
        </div>
      </div>

      {/* 4. LIVE REPORT DATA TABLE */}
      <div className="ab-table-card">
        <div className="ab-table-scroll">
          <table className="ab-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th
                  className="th-date sortable-th"
                  onClick={() => handleHeaderSort("date")}
                  title="Click to sort by date"
                >
                  DATE {sortBy === "date" && (sortOrder === "desc" ? "▼" : "▲")}
                </th>
                <th
                  className="th-ticker sortable-th"
                  onClick={() => handleHeaderSort("ticker")}
                  title="Click to sort by ticker"
                >
                  TICKER {sortBy === "ticker" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-scenario sortable-th"
                  onClick={() => handleHeaderSort("scenario")}
                  title="Click to sort by scenario"
                >
                  SCENARIO {sortBy === "scenario" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-cmp sortable-th"
                  onClick={() => handleHeaderSort("cmp")}
                  title="Click to sort by CMP"
                >
                  CMP {sortBy === "cmp" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="ab-empty-cell">
                    <div className="ab-loading-box">
                      <span className="ab-spinner">⏳</span>
                      <span>Detecting Top &amp; Bottom Extreme Zone Breakouts...</span>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ab-empty-cell">
                    <div className="ab-loading-box">
                      <span className="ab-spinner">📊</span>
                      <span>No stocks matched the extreme top/bottom criteria. Click RUN SCANNER to scan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  const isTop = row.scenarioType === "top" || String(row.scenario).toUpperCase().includes("TOP");

                  return (
                    <tr key={`${row.symbol}-${row.date}-${idx}`} className="ab-row">
                      {/* 1. SR */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* 2. DATE */}
                      <td className="td-date">{row.date || "—"}</td>

                      {/* 3. TICKER (CLICK ROUTES TO DATA SUMMARY) */}
                      <td className="td-ticker">
                        <span
                          className="ticker-badge-link"
                          onClick={() => handleStockClick(row)}
                          title={`Click to open ${cleanSym} Data Summary & Analytics`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* 4. SCENARIO - EXTREME AB TOP / BOTTOM */}
                      <td className="td-scenario">
                        {isTop ? (
                          <span
                            className="status-pill status-top"
                            title={row.refBaseline ? `Triggered: Close (₹${row.cmp}) > Top High (₹${row.refBaseline}) AND Avg (₹${row.triggerAvg}) > Top High (₹${row.refBaseline}) | Pivot Date: ${row.refDate}` : "extreme Ab top"}
                          >
                            🔴 extreme Ab top
                          </span>
                        ) : (
                          <span
                            className="status-pill status-bottom"
                            title={row.refBaseline ? `Triggered: Close (₹${row.cmp}) < Bottom Low (₹${row.refBaseline}) AND Avg (₹${row.triggerAvg}) < Bottom Low (₹${row.refBaseline}) | Pivot Date: ${row.refDate}` : "extreme Ab bottom"}
                          >
                            🟢 extreme Ab bottom
                          </span>
                        )}
                      </td>

                      {/* 5. CMP - MARKET CLOSED VALUE */}
                      <td className="td-cmp">
                        <strong>
                          ₹{Number(row.cmp || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
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
