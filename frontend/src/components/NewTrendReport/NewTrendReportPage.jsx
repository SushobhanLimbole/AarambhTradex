import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./NewTrendReportPage.css";
import trendReportService from "../../services/trendReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { getConditionalActionDate, formatDateDisplay } from "../../utils/dateUtils.js";
import SearchableSelect from "../Common/SearchableSelect.jsx";
import { openStockAnalyticsInNewTab } from "../../utils/navigationUtils.js";

const TIMEFRAMES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

// Preset indices with stock counts
const PRESET_INDICES = [
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

const getTriggerClass = (trigger) => {
  if (!trigger) return "trigger-badge-yellow";
  const t = String(trigger).toUpperCase();
  if (t.startsWith("Y")) return "trigger-badge-yellow";
  if (t.startsWith("G")) return "trigger-badge-green";
  if (t.startsWith("R")) return "trigger-badge-red";
  return "trigger-badge-yellow";
};

const getPointerBadgeColor = (pointer) => {
  if (!pointer || pointer === "—" || pointer === "FALSE") return "pointer-neutral";
  const p = String(pointer).toUpperCase();
  if (p.includes("TABLE TENNIS")) return "pointer-blue";
  if (p.includes("TABLE TOP")) return "pointer-purple";
  if (p.includes("UPWARD ROTATION")) return "pointer-cyan";
  if (p.includes("RISING JACK") || p.includes("BUYING")) return "pointer-emerald";
  if (p.includes("FALLING DUCK") || p.includes("SELLING")) return "pointer-amber";
  return "pointer-indigo";
};

export default function NewTrendReportPage({
  onOpenStrategy,
  onOpenPointer,
  onOpenStockAnalytics,
  onBack,
}) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");

  // Conditional Date Logic: 6:00 PM or later = today's date; before 6:00 PM = previous working day
  const [actionDate, setActionDate] = useState(() => getConditionalActionDate());
  const [mode, setMode] = useState("set1"); // 'set1' (RUN) or 'set2' (ADV)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // 'date' | 'ticker' | 'status' | 'pointer' | 'price'
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' | 'desc' (default newest first)

  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [indexOptions, setIndexOptions] = useState(PRESET_INDICES);

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, upTrends: 0, downTrends: 0, highPower: 0 });

  // 1. Fetch metadata on mount to enrich indices with live counts
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
        console.warn("Meta load warning:", e);
      }
    }
    loadMeta();
  }, []);

  // 2. Run Trend Scanner
  const handleRunScan = useCallback(async (selectedMode = mode) => {
    setLoading(true);
    setError("");
    setMode(selectedMode);
    try {
      const res = await trendReportService.getTrendReport({
        exchange,
        indice: indexVal,
        timeframe,
        actionDate: actionDate || undefined,
        mode: selectedMode,
      });

      if (res?.data && Array.isArray(res.data)) {
        setReportData(res.data);
        if (res.rawActionDate && !actionDate) {
          setActionDate(res.rawActionDate);
        }

        // Compute summary statistics
        let up = 0;
        let down = 0;
        let hp = 0;
        res.data.forEach((r) => {
          if (r.currTrend === "UP-TREND") up++;
          if (r.currTrend === "DOWN-TREND") down++;
          if (r.power === "HIGH") hp++;
        });
        setStats({ total: res.data.length, upTrends: up, downTrends: down, highPower: hp });
      } else {
        setReportData([]);
        setStats({ total: 0, upTrends: 0, downTrends: 0, highPower: 0 });
      }
    } catch (err) {
      console.error("Trend Report Scan Error:", err);
      setError(err.message || "Failed to generate trend scanner report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indexVal, timeframe, actionDate, mode]);

  // Load initial scan on filter change
  useEffect(() => {
    handleRunScan("set1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchange, indexVal, timeframe]);

  // Handle column header sort toggle
  const handleHeaderSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder(columnKey === "date" ? "desc" : "asc");
    }
  };

  // Filter and sort data (Default: newest date first)
  const processedData = useMemo(() => {
    let list = [...reportData];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const sym = stripSymbolSuffix(r.symbol).toLowerCase();
        const pointer = String(r.pointer || r.monthlyPointer || "").toLowerCase();
        const trend = String(r.currTrend || "").toLowerCase();
        return sym.includes(q) || pointer.includes(q) || trend.includes(q);
      });
    }

    // Sort list
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        const tA = a.rawTrendDate ? new Date(a.rawTrendDate).getTime() : 0;
        const tB = b.rawTrendDate ? new Date(b.rawTrendDate).getTime() : 0;
        comparison = tB - tA; // Newest first
        if (comparison === 0) {
          comparison = a.symbol.localeCompare(b.symbol);
        }
        return sortOrder === "asc" ? -comparison : comparison;
      } else if (sortBy === "ticker") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortBy === "status") {
        comparison = String(a.currTrend || "").localeCompare(String(b.currTrend || ""));
      } else if (sortBy === "pointer") {
        comparison = String(a.pointer || a.monthlyPointer || "").localeCompare(String(b.pointer || b.monthlyPointer || ""));
      } else if (sortBy === "price") {
        comparison = (Number(a.price) || 0) - (Number(b.price) || 0);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  }, [reportData, searchQuery, sortBy, sortOrder]);

  // Navigation handler to route directly to Data Summary page on a new tab with date highlighting
  const handleStockClick = (row) => {
    openStockAnalyticsInNewTab({
      symbol: row.symbol,
      exchange: row.exchange || exchange || "NSE",
      indice: indexVal || "ALL",
      timeframe: timeframe || "Daily",
      highlightDate: row.rawDate || row.date || row.rawTrendDate || row.trendDate || actionDate,
    });
  };

  return (
    <div className="new-trend-report-wrapper">
      {/* TOP CONTROL TOOLBAR */}
      <div className="ntr-top-toolbar">
        {onBack && (
          <button
            type="button"
            className="ntr-back-btn"
            onClick={onBack}
            title="Return to Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        {/* <div className="ntr-title-brand">
          <span className="ntr-logo-icon">📈</span>
          <span className="ntr-brand-text">Trend Scanner &amp; Monthly Pointer</span>
        </div> */}

        {/* EXCHANGE */}
        <div className="ntr-control-item" style={{ minWidth: 140 }}>
          <label className="ntr-label">Exchange</label>
          <SearchableSelect
            options={[{ value: "ALL", label: "ALL" }, ...availableExchanges.map((ex) => ({ value: ex, label: ex }))]}
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            compact
          />
        </div>

        {/* INDEX */}
        <div className="ntr-control-item ntr-wide-item" style={{ minWidth: 260 }}>
          <label className="ntr-label">Index</label>
          <SearchableSelect
            options={[{ value: "ALL", label: "ALL (All Stocks)" }, ...indexOptions]}
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
            compact
          />
        </div>

        {/* TIMEFRAME */}
        <div className="ntr-control-item" style={{ minWidth: 160 }}>
          <label className="ntr-label">Timeframe</label>
          <SearchableSelect
            options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            compact
          />
        </div>

        {/* ACTION DATE (CONDITIONAL DEFAULT APPLIED) */}
        <div className="ntr-control-item">
          <label className="ntr-label">Action Date</label>
          <input
            type="date"
            className="ntr-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            title="Defaults to today's date if after 6:00 PM, or previous working day if before 6:00 PM"
          />
        </div>

        {/* ACTION BUTTONS */}
        <div className="ntr-btn-group">
          <button
            type="button"
            className={`ntr-btn ntr-btn-run ${mode === "set1" ? "active" : ""}`}
            onClick={() => handleRunScan("set1")}
            disabled={loading}
          >
            <span className="ntr-btn-main">RUN</span>
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="ntr-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* SUMMARY STATS & SEARCH BAR */}
      <div className="ntr-stats-bar">
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">Total Stocks:</span>
          <span className="ntr-stat-val">{stats.total}</span>
        </div>
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">HLC HIGHER:</span>
          <span className="ntr-stat-val text-green">{stats.upTrends}</span>
        </div>
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">HLC LOWER:</span>
          <span className="ntr-stat-val text-red">{stats.downTrends}</span>
        </div>

        {/* SEARCH BOX */}
        <div className="ntr-search-wrapper">
          <input
            type="text"
            placeholder="Search symbol, pointer, status..."
            className="ntr-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="ntr-search-clear"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          )}
        </div>

        <div className="ntr-stat-badge">
          <span>HLC HIGHER / LOWER • {timeframe === "Daily" ? "POINTER" : `${timeframe.toUpperCase()} POINTER`} &amp; YGR BREAKOUT</span>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="ntr-table-card">
        <div className="ntr-table-scroll">
          <table className="ntr-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th
                  className="th-ticker sortable-th"
                  onClick={() => handleHeaderSort("ticker")}
                  title="Click to sort by ticker"
                >
                  TICKER {sortBy === "ticker" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-trend sortable-th"
                  onClick={() => handleHeaderSort("status")}
                  title="Click to sort by status"
                >
                  CURR STATUS {sortBy === "status" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="th-date sortable-th"
                  onClick={() => handleHeaderSort("date")}
                  title="Click to sort by date (default: newest first)"
                >
                  STATUS DATE {sortBy === "date" && (sortOrder === "desc" ? "▼ (Newest)" : "▲ (Oldest)")}
                </th>
                <th
                  className="th-pointer sortable-th"
                  onClick={() => handleHeaderSort("pointer")}
                  title="Displays stock's pointer type for the entire previous month (Monthly timeframe)"
                >
                  {timeframe === "Daily" ? "MONTHLY POINTER" : `${timeframe.toUpperCase()} POINTER`} {sortBy === "pointer" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="th-ygr" title="Previous month's pointer trigger values (Y, G, R) compared against today's CMP closing price">
                  ygr
                </th>
                <th
                  className="th-price sortable-th"
                  onClick={() => handleHeaderSort("price")}
                  title="Click to sort by CMP close price"
                >
                  CMP CLOSE {sortBy === "price" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead >
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="ntr-empty-cell">
                    <div className="ntr-loading-box">
                      <span className="ntr-spinner">⏳</span>
                      <span>Calculating Trend Matrices, Pointers &amp; YGR Comparisons...</span>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ntr-empty-cell">
                    <div className="ntr-loading-box">
                      <span className="ntr-spinner">📊</span>
                      <span>No trend records matched the criteria. Click RUN to scan all symbols.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  const isUpTrend = row.currTrend === "UP-TREND";
                  const isDownTrend = row.currTrend === "DOWN-TREND";
                  const pointerText = row.pointer || row.monthlyPointer;
                  const pointerDateText = row.pointerDate || row.monthlyPointerDate;
                  const pointerBadgeClass = getPointerBadgeColor(pointerText);

                  return (
                    <tr key={row.symbol || idx} className="ntr-row">
                      {/* SR */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* TICKER (CLICK ROUTES TO DATA SUMMARY PAGE) */}
                      <td className="td-ticker">
                        <span
                          className="ticker-pill-link"
                          onClick={() => handleStockClick(row)}
                          title={`Click to open ${cleanSym} Data Summary & Analytics`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* CURR TREND */}
                      <td className="td-trend">
                        {isUpTrend && <div className="trend-badge badge-green">HLC HIGHER</div>}
                        {isDownTrend && <div className="trend-badge badge-red">HLC LOWER</div>}
                        {!isUpTrend && !isDownTrend && <span className="ntr-muted">—</span>}
                      </td>

                      {/* TREND DATE */}
                      <td className="td-date">{row.trendDate || "—"}</td>

                      {/* POINTER */}
                      <td className="td-pointer">
                        {pointerText && pointerText !== "—" ? (
                          <div className="pointer-cell-group">
                            <span className={`monthly-pointer-badge ${pointerBadgeClass}`}>
                              {pointerText}
                            </span>
                            {/* {pointerDateText && pointerDateText !== "—" && (
                              <span className="pointer-date-subtext">
                                ({pointerDateText})
                              </span>
                            )} */}
                          </div >
                        ) : (
                          <span className="ntr-muted">—</span>
                        )
                        }
                      </td >

                      {/* YGR (TIMEFRAME POINTER TRIGGER VALUES COMPARED TO CLOSE) */}
                      < td className="td-ygr" >
                        <div className="matched-triggers-cell">
                          {row.ygr && row.ygr.length > 0 ? (
                            row.ygr.map((item) => {
                              const trigClass = getTriggerClass(item.trigger);
                              const isPositive = item.diffPct >= 0;
                              return (
                                <span
                                  key={`${row.symbol}-${item.trigger}`}
                                  className={`matched-trigger-tag ${trigClass}`}
                                  title={`${item.trigger} Level: ₹${Number(item.triggerPrice).toFixed(2)} (CMP Close: ₹${Number(row.price || 0).toFixed(2)}, ${isPositive ? "+" : ""}${item.diffPct}%)`}
                                >
                                  <strong>{item.trigger}</strong>
                                  {item.triggerPrice !== undefined && (
                                    <span className="tag-price">@ ₹{Number(item.triggerPrice).toFixed(2)}</span>
                                  )}
                                  {item.diffPct !== undefined && (
                                    <span className="tag-pct">
                                      {isPositive ? `+${item.diffPct}%` : `${item.diffPct}%`}
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          ) : (
                            <span className="ntr-muted">—</span>
                          )}
                        </div>
                      </td >

                      {/* CMP CLOSE PRICE */}
                      < td className="td-price" >
                        <span className="price-badge">
                          {row.price !== null && row.price !== undefined
                            ? `₹${Number(row.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </span>
                      </td >
                    </tr >
                  );
                })
              )}
            </tbody >
          </table >
        </div >
      </div >
    </div >
  );
}
