import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./CbReportPage.css";
import cbReportService from "../../services/cbReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { openStockAnalyticsInNewTab } from "../../utils/navigationUtils.js";

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

export default function CbReportPage({ onOpenStrategy, onOpenPointer, onOpenStockAnalytics, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // 'sr' | 'date' | 'ticker'
  const [sortOrder, setSortOrder] = useState("desc");

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTimeoutError, setIsTimeoutError] = useState(false);
  const [scanSeconds, setScanSeconds] = useState(0);

  const abortControllerRef = useRef(null);
  const clientCacheRef = useRef(new Map());

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

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 2. Fetch Report with client caching, timer, and cancellation
  const handleFetchReport = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cacheKey = `${exchange}_${indexVal}_${timeframe}_${actionDate || "latest"}`;
    if (!forceRefresh && clientCacheRef.current.has(cacheKey)) {
      const cached = clientCacheRef.current.get(cacheKey);
      setReportData(cached.data);
      if (cached.rawActionDate && !actionDate) {
        setActionDate(cached.rawActionDate);
      }
      setError("");
      setIsTimeoutError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setScanSeconds(0);
    setError("");
    setIsTimeoutError(false);

    const timer = setInterval(() => {
      setScanSeconds((s) => s + 1);
    }, 1000);

    try {
      const res = await cbReportService.getCbReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: actionDate || undefined,
        filterType: "ALL",
      }, {
        signal: controller.signal,
      });

      clearInterval(timer);

      if (res?.data && Array.isArray(res.data)) {
        setReportData(res.data);
        clientCacheRef.current.set(cacheKey, {
          data: res.data,
          rawActionDate: res.rawActionDate,
        });
        if (res.rawActionDate && !actionDate) {
          setActionDate(res.rawActionDate);
        }
      } else {
        setReportData([]);
      }
    } catch (err) {
      clearInterval(timer);
      if (err.name === "AbortError") {
        return;
      }
      console.error("CB Report Error:", err);
      const is504 = err.status === 504 || (err.message && (err.message.includes("504") || err.message.toLowerCase().includes("timed out")));
      setIsTimeoutError(is504);
      if (is504) {
        setError("Gateway Timeout (504): Scanning 2,300+ stocks took longer than the server limit. Click retry below, or select a focused index for instant results.");
      } else {
        setError(err.message || "Failed to load Comparative Study report.");
      }
      setReportData([]);
    } finally {
      clearInterval(timer);
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
      list = list.filter((row) => {
        const sym = stripSymbolSuffix(row.symbol).toLowerCase();
        const dt = String(row.date || "").toLowerCase();
        return sym.includes(q) || dt.includes(q);
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
      }
      return sortOrder === "asc" ? comp : -comp;
    });

    return list;
  }, [reportData, searchQuery, sortBy, sortOrder]);

  // Click on stock routes directly to Data Summary / Analytics page on a new tab with date highlighting
  const handleStockClick = (row) => {
    openStockAnalyticsInNewTab({
      symbol: row.symbol,
      exchange: row.exchange || exchange || "NSE",
      indice: indexVal || "ALL",
      timeframe: timeframe || "Daily",
      highlightDate: row.rawDate || row.date || row.cbDate || actionDate,
    });
  };

  return (
    <div className="cb-report-wrapper">
      {/* 1. TITLE & CONTEXT BANNER */}
      <div className="cb-page-header-card">
        <div className="cb-title-block">
          <div className="cb-badge-pill">REPORT CARD 4</div>
          <h1 className="cb-page-title">Comparative Study</h1>
          <p className="cb-page-subtitle">
            Includes <strong>Type 1 (Ordinary CB)</strong> and <strong>Type 2 (Advanced CB)</strong>
          </p>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR */}
      <div className="cb-toolbar">
        {onBack && (
          <button
            type="button"
            className="cb-back-btn"
            onClick={onBack}
            title="Return to Report Cards Hub"
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

        {/* Run Scan Button */}
        <button
          type="button"
          className="cb-run-btn"
          onClick={() => handleFetchReport(true)}
          disabled={loading}
        >
          {loading ? `Scanning... (${scanSeconds}s)` : "RUN SCANNER"}
        </button>
      </div>

      {/* Error Banner with 504 Recovery Actions */}
      {error && (
        <div className={`cb-error-banner ${isTimeoutError ? "cb-timeout-banner" : ""}`}>
          <div className="cb-error-content">
            <span className="cb-error-icon">⚠️</span>
            <div className="cb-error-text">
              <strong>{isTimeoutError ? "Gateway Timeout (Status 504)" : "Notice"}</strong>
              <p>{error}</p>
            </div>
          </div>
          {isTimeoutError && (
            <div className="cb-error-actions">
              <button
                type="button"
                className="cb-retry-btn"
                onClick={() => handleFetchReport(true)}
                disabled={loading}
              >
                ↻ Retry Scanner
              </button>
              <span className="cb-switch-label">Or choose a faster index:</span>
              <button
                type="button"
                className="cb-quick-filter-btn"
                onClick={() => setIndexVal("NIFTY 50")}
              >
                NIFTY 50 (50 stocks)
              </button>
              <button
                type="button"
                className="cb-quick-filter-btn"
                onClick={() => setIndexVal("F&O")}
              >
                F&amp;O (210 stocks)
              </button>
              <button
                type="button"
                className="cb-quick-filter-btn"
                onClick={() => setIndexVal("TOP 500")}
              >
                TOP 500
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. SEARCH & TABLE STATS */}
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
          <span>Showing <strong>{processedData.length}</strong> of <strong>{reportData.length}</strong> breakout stocks</span>
        </div>
      </div>

      {/* 4. COMPARATIVE STUDY TABLE WITH NESTED SUB-COLUMNS */}
      <div className="cb-table-card">
        <div className="cb-table-scroll">
          <table className="cb-table">
            <thead>
              {/* Row 1: Main Headers */}
              <tr>
                <th rowSpan={2} className="th-sr">Sr</th>
                <th
                  rowSpan={2}
                  className="th-date sortable-th"
                  onClick={() => handleHeaderSort("date")}
                  title="Click to sort by date"
                >
                  Date {sortBy === "date" && (sortOrder === "desc" ? "▼" : "▲")}
                </th>
                <th
                  rowSpan={2}
                  className="th-ticker sortable-th"
                  onClick={() => handleHeaderSort("ticker")}
                  title="Click to sort by ticker"
                >
                  Ticker {sortBy === "ticker" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th colSpan={2} className="th-group-bullish">
                  🟢 Bullish
                </th>
                <th colSpan={2} className="th-group-bearish">
                  🔴 Bearish
                </th>
              </tr>
              {/* Row 2: Sub-Columns */}
              <tr>
                <th className="th-sub sub-bullish" title="Ordinary Bullish CB: HLC HIGHER occurred first -> CB made after HLC Higher (Day 1 Close > Avg & Day 2 Close > Prev High)">
                  Ordinary
                </th>
                <th className="th-sub sub-bullish" title="Advanced Bullish CB: CB formed & Next Day compulsory HLC HIGHER formed">
                  Advanced CB
                </th>
                <th className="th-sub sub-bearish" title="Ordinary Bearish CB: HLC LOWER occurred first -> CB made after HLC Lower (Day 1 Close < Avg & Day 2 Close < Prev Low)">
                  Ordinary
                </th>
                <th className="th-sub sub-bearish" title="Advanced Bearish CB: CB formed & Next Day compulsory HLC LOWER formed">
                  Advanced CB
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="cb-empty-cell">
                    <div className="cb-loading-box">
                      <span className="cb-spinner">⏳</span>
                      <span>
                        Calculating Comparative Study (Ordinary &amp; Advanced CB) Matrices...
                        {scanSeconds > 0 && ` (${scanSeconds}s elapsed)`}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : isTimeoutError ? (
                <tr>
                  <td colSpan={7} className="cb-empty-cell">
                    <div className="cb-loading-box cb-timeout-box">
                      <span className="cb-spinner">⚠️</span>
                      <strong style={{ fontSize: "15px", color: "#b91c1c" }}>
                        Scanning Timed Out (Status 504)
                      </strong>
                      <p style={{ margin: "6px 0 14px", color: "#64748b", maxWidth: "480px" }}>
                        The server gateway timed out while processing 2,300+ stocks. Click retry below, or choose a focused index for instant results.
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                        <button
                          type="button"
                          className="cb-run-btn"
                          style={{ margin: 0, padding: "0 16px", height: "36px" }}
                          onClick={() => handleFetchReport(true)}
                        >
                          ↻ Retry Scanner
                        </button>
                        <button
                          type="button"
                          className="cb-back-btn"
                          style={{ margin: 0, padding: "0 14px", height: "36px" }}
                          onClick={() => setIndexVal("NIFTY 50")}
                        >
                          Scan NIFTY 50
                        </button>
                        <button
                          type="button"
                          className="cb-back-btn"
                          style={{ margin: 0, padding: "0 14px", height: "36px" }}
                          onClick={() => setIndexVal("F&O")}
                        >
                          Scan F&amp;O (210)
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="cb-empty-cell">
                    <div className="cb-loading-box">
                      <span className="cb-spinner">📊</span>
                      <span>No stocks matched the Comparative Study criteria for the selected date.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  // Strict 1-of-4 classification
                  const isAdvBull = Boolean(row.isAdvancedBullish || row.isBullishCbWithStatus);
                  const isOrdBull = !isAdvBull && Boolean(row.isOrdinaryBullish || (row.isBullish && !row.isBearish));

                  const isAdvBear = Boolean(row.isAdvancedBearish || row.isBearishCbWithStatus);
                  const isOrdBear = !isAdvBear && Boolean(row.isOrdinaryBearish || (row.isBearish && !row.isBullish));

                  return (
                    <tr key={row.symbol || idx} className="cb-row">
                      {/* 1. Sr */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* 2. Date */}
                      <td className="td-date">{row.date || "—"}</td>

                      {/* 3. Ticker */}
                      <td className="td-ticker">
                        <span
                          className="ticker-badge-link"
                          onClick={() => handleStockClick(row)}
                          title={`Click to open ${cleanSym} Data Summary & Analytics`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* 4. Bullish -> Ordinary */}
                      <td className="td-signal td-bull-cell">
                        {isOrdBull ? (
                          <span
                            className="cb-signal-pill pill-bullish-ord"
                            title={`Ordinary CB: HLC HIGHER occurred first, then Day 1 Close (₹${row.prevClose}) > Avg (₹${row.prevAvg}) & Day 2 Close (₹${row.price}) > Prev High (₹${row.prevHigh})`}
                          >
                             Ordinary
                          </span>
                        ) : (
                          <span className="cb-muted">—</span>
                        )}
                      </td>

                      {/* 5. Bullish -> Advanced CB */}
                      <td className="td-signal td-bull-cell">
                        {isAdvBull ? (
                          <span
                            className="cb-signal-pill pill-bullish-adv"
                            title={`Advanced CB: CB formed & Next Day compulsory HLC HIGHER formed`}
                          >
                             Advanced CB
                          </span>
                        ) : (
                          <span className="cb-muted">—</span>
                        )}
                      </td>

                      {/* 6. Bearish -> Ordinary */}
                      <td className="td-signal td-bear-cell">
                        {isOrdBear ? (
                          <span
                            className="cb-signal-pill pill-bearish-ord"
                            title={`Ordinary CB: HLC LOWER occurred first, then Day 1 Close (₹${row.prevClose}) < Avg (₹${row.prevAvg}) & Day 2 Close (₹${row.price}) < Prev Low (₹${row.prevLow})`}
                          >
                             Ordinary
                          </span>
                        ) : (
                          <span className="cb-muted">—</span>
                        )}
                      </td>

                      {/* 7. Bearish -> Advanced CB */}
                      <td className="td-signal td-bear-cell">
                        {isAdvBear ? (
                          <span
                            className="cb-signal-pill pill-bearish-adv"
                            title={`Advanced CB: CB formed & Next Day compulsory HLC LOWER formed`}
                          >
                             Advanced CB
                          </span>
                        ) : (
                          <span className="cb-muted">—</span>
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
