import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./PointerReportPage.css";
import pointerReportService from "../../services/pointerReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { getConditionalActionDate } from "../../utils/dateUtils.js";
import { openStockAnalyticsInNewTab } from "../../utils/navigationUtils.js";
import SearchableSelect from "../Common/SearchableSelect.jsx";

const TIMEFRAME_OPTIONS = [
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Yearly", label: "Yearly" },
  { value: "5-Yearly", label: "5-Yearly" },
];

export default function PointerReportPage({ onOpenStrategy, onOpenPointer, onBack }) {
  // Filter States
  const [exchange, setExchange] = useState("ALL");
  const [indice, setIndice] = useState("ALL");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState(() => getConditionalActionDate());
  const [searchTerm, setSearchTerm] = useState("");

  // Data & Metadata States
  const [reportData, setReportData] = useState([]);
  const [meta, setMeta] = useState({
    exchanges: ["NSE", "BSE", "CRYPTO", "METALS"],
    indices: [],
    totalSymbols: 0,
  });
  const [hasScanned, setHasScanned] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const exchangeOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All Exchanges" },
      ...meta.exchanges.map((ex) => ({ value: ex, label: ex })),
    ];
  }, [meta.exchanges]);

  const indiceOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All Indices" },
      ...meta.indices.map((idx) => ({ value: idx, label: idx })),
    ];
  }, [meta.indices]);

  const pageSizeOptions = useMemo(
    () => [
      { value: 25, label: "25" },
      { value: 50, label: "50" },
      { value: 100, label: "100" },
      { value: 200, label: "200" },
      { value: "ALL", label: "All" },
    ],
    []
  );

  // 1. Fetch Metadata (exchanges, indices) on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadMeta() {
      try {
        const res = await stockService.getSymbolsMeta();
        if (!isCancelled && res?.data) {
          setMeta({
            exchanges: res.data.exchanges || ["NSE", "BSE", "CRYPTO", "METALS"],
            indices: res.data.indices || [],
            totalSymbols: res.data.totalSymbols || 0,
          });
        }
      } catch (err) {
        console.warn("Failed to load symbols meta:", err);
      }
    }
    loadMeta();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Fetch Pointer Report Data (Executed on mount once & on clicking Scan Pointers)
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setHasScanned(true);
    setError("");
    try {
      const res = await pointerReportService.getPointerReport({
        exchange: exchange !== "ALL" ? exchange : undefined,
        indice: indice !== "ALL" ? indice : undefined,
        timeframe,
        actionDate,
      });

      if (res?.data && Array.isArray(res.data)) {
        setReportData(res.data);
      } else {
        setReportData([]);
      }
      setCurrentPage(1);
    } catch (err) {
      console.error("Error fetching Pointer Report:", err);
      setError(err.message || "Failed to load Pointer Report from server.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indice, timeframe, actionDate]);

  // Initial fetch on mount only (changing timeframe or filters requires clicking Scan Pointers)
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side search filtering across symbol, cleanSymbol, companyName, indice, exchange, and pointer
  const filteredData = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) {
      return reportData;
    }
    const term = searchTerm.trim().toLowerCase();
    return reportData.filter((item) => {
      const symMatch = item.symbol && item.symbol.toLowerCase().includes(term);
      const cleanMatch = item.cleanSymbol && item.cleanSymbol.toLowerCase().includes(term);
      const compMatch = item.companyName && item.companyName.toLowerCase().includes(term);
      const indMatch = item.indice && item.indice.toLowerCase().includes(term);
      const exMatch = item.exchange && item.exchange.toLowerCase().includes(term);
      const ptrMatch = item.pointer && item.pointer.toLowerCase().includes(term);
      return symMatch || cleanMatch || compMatch || indMatch || exMatch || ptrMatch;
    });
  }, [reportData, searchTerm]);

  // Pagination calculation
  const totalItems = filteredData.length;
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(totalItems / pageSize);
  const paginatedData = useMemo(() => {
    if (pageSize === "ALL") return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Selected row highlight state
  const [selectedRowSymbol, setSelectedRowSymbol] = useState(null);

  const handleRowClick = (item) => {
    setSelectedRowSymbol(item.symbol);
    openStockAnalyticsInNewTab({
      symbol: item.symbol,
      exchange: item.exchange || exchange || "ALL",
      indice: item.indice || indice || "ALL",
      timeframe,
      highlightDate: item.rawDate || item.targetDate || actionDate,
    });
  };

  const handleClearFilters = () => {
    setExchange("ALL");
    setIndice("ALL");
    setTimeframe("Daily");
    setActionDate(getConditionalActionDate());
    setSearchTerm("");
    setCurrentPage(1);
  };

  const getExchangeClass = (ex) => {
    const u = String(ex || "").toUpperCase();
    if (u.includes("NSE")) return "nse";
    if (u.includes("BSE")) return "bse";
    if (u.includes("CRYPTO")) return "crypto";
    if (u.includes("METAL")) return "metals";
    return "nse";
  };

  const getPointerBadgeClass = (ptr) => {
    const u = String(ptr || "").toUpperCase();
    if (u.includes("RISING JACK")) return "pointer-badge-rising-jack";
    if (u.includes("FALLING DUCK")) return "pointer-badge-falling-duck";
    if (u.includes("TABLE TENNIS")) return "pointer-badge-table-tennis";
    if (u.includes("TABLE TOP")) return "pointer-badge-table-top";
    if (u.includes("UPWARD ROTATION")) return "pointer-badge-upward-rot";
    return "pointer-badge-none";
  };

  const getPointerIcon = (ptr) => {
    const u = String(ptr || "").toUpperCase();
    if (u.includes("RISING JACK")) return "🟢";
    if (u.includes("FALLING DUCK")) return "🔴";
    if (u.includes("TABLE TENNIS")) return "🔵";
    if (u.includes("TABLE TOP")) return "🟣";
    if (u.includes("UPWARD ROTATION")) return "🟠";
    return "";
  };

  const handleExportCSV = () => {
    if (!filteredData || filteredData.length === 0) return;
    const headers = [
      "Sr No",
      "Symbol",
      "Company Name",
      "Index",
      "Exchange",
      "Timeframe",
      "Target Date",
      "Pointer Scenario",
      "Open",
      "High",
      "Low",
      "Close",
      "Range",
      "Average",
    ];

    const rows = filteredData.map((item, idx) => [
      idx + 1,
      item.symbol,
      `"${(item.companyName || "").replace(/"/g, '""')}"`,
      `"${(item.indice || "").replace(/"/g, '""')}"`,
      item.exchange || "NSE",
      item.timeframe || timeframe,
      item.targetDate || "",
      item.pointer || "—",
      item.open ?? "",
      item.high ?? "",
      item.low ?? "",
      item.close ?? "",
      item.range ?? "",
      item.average ?? "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pointer_report_${timeframe.toLowerCase()}_${actionDate || "latest"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pointer-report-page-container">
      {/* Back to Report Cards button if navigated from Report Hub */}
      {onBack && (
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={onBack}
            className="pointer-back-hub-btn"
          >
            ← Back to Report Cards
          </button>
        </div>
      )}

      {/* Dark Controls Toolbar (#0f172a) */}
      <div className="pointer-report-toolbar">
        <div className="pointer-toolbar-left">
          {/* Search Input */}
          <div className="pointer-search-wrap">
            <span className="pointer-search-icon">🔍</span>
            <input
              type="text"
              className="pointer-search-input"
              placeholder="Search by Symbol, Company Name, Index, or Pointer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                className="pointer-search-clear"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Exchange Filter */}
          <div className="pointer-select-wrap">
            <label className="pointer-select-label">Exchange:</label>
            <SearchableSelect
              options={exchangeOptions}
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              compact
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Indice Filter */}
          <div className="pointer-select-wrap">
            <label className="pointer-select-label">Index:</label>
            <SearchableSelect
              options={indiceOptions}
              value={indice}
              onChange={(e) => setIndice(e.target.value)}
              compact
              style={{ minWidth: 180 }}
            />
          </div>

          {/* Timeframe Filter */}
          <div className="pointer-select-wrap">
            <label className="pointer-select-label">Timeframe:</label>
            <SearchableSelect
              options={TIMEFRAME_OPTIONS}
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              compact
              style={{ minWidth: 120 }}
            />
          </div>

          {/* Action Date Picker */}
          {/* <div className="pointer-select-wrap">
            <label className="pointer-select-label">Action Date:</label>
            <input
              type="date"
              className="pointer-date-input"
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
            />
          </div> */}
        </div>

        <div className="pointer-toolbar-right">
          {(exchange !== "ALL" || indice !== "ALL" || timeframe !== "Daily" || searchTerm) && (
            <button
              className="pointer-btn pointer-btn-ghost"
              onClick={handleClearFilters}
              title="Reset all filters"
            >
              <span>↺</span> Reset Filters
            </button>
          )}

          <button
            className="pointer-btn pointer-btn-export"
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            title="Export filtered results to CSV"
          >
            <span>📥</span> Export CSV
          </button>

          <button
            className="pointer-btn pointer-btn-primary"
            onClick={fetchReport}
            title="Scan database for pointers"
          >
            <span>⚡</span> Scan Pointers
          </button>
        </div>
      </div>

      {/* Main Table Card (Exact same structure & styles as Symbols Page + Pointer Column) */}
      <div className="symbols-table-card">
        <div className="symbols-table-header-info">
          <div>
            Showing <span className="symbols-count-highlight">{filteredData.length}</span> stocks
            {exchange !== "ALL" ? ` on ${exchange}` : ""}
            {indice !== "ALL" ? ` in ${indice}` : ""}
            {timeframe ? ` • ${timeframe} Timeframe` : ""}
            {actionDate ? ` • ${actionDate}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Rows per page:</span>
            <SearchableSelect
              options={pageSizeOptions}
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === "ALL" ? "ALL" : Number(e.target.value));
                setCurrentPage(1);
              }}
              compact
              style={{ minWidth: 85 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="symbols-state-box">
            <div className="symbols-spinner"></div>
            <div className="symbols-state-title">Scanning Pointers &amp; Calculating Scenarios...</div>
            <div className="symbols-state-desc">
              Retrieving candle periods and evaluating institutional pointers for {timeframe} timeframe.
            </div>
          </div>
        ) : error ? (
          <div className="symbols-state-box">
            <span style={{ fontSize: 36, marginBottom: 12 }}>⚠️</span>
            <div className="symbols-state-title">Error Loading Pointer Report</div>
            <div className="symbols-state-desc">{error}</div>
            <button className="symbols-btn symbols-btn-primary" onClick={fetchReport}>
              Retry Scan
            </button>
          </div>
        ) : !hasScanned ? (
          <div className="symbols-state-box">
            <span style={{ fontSize: 36, marginBottom: 12 }}>🎯</span>
            <div className="symbols-state-title">Ready to Scan Pointers</div>
            <div className="symbols-state-desc">
              Select your Exchange, Index, and Timeframe above, then click <strong>Scan Pointers</strong> to calculate today's pointers.
            </div>
            <button className="symbols-btn symbols-btn-primary" onClick={fetchReport}>
              <span>⚡</span> Scan Pointers Now
            </button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="symbols-state-box">
            <span style={{ fontSize: 36, marginBottom: 12 }}>🔍</span>
            <div className="symbols-state-title">No Pointer Data Found</div>
            <div className="symbols-state-desc">
              No matching instruments found for your current timeframe, date, and filter criteria.
            </div>
            <button className="symbols-btn symbols-btn-ghost" onClick={handleClearFilters}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="symbols-table-scroll">
            <table className="symbols-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>#</th>
                  <th>Symbol</th>
                  <th>Company Name</th>
                  <th>Index</th>
                  <th>Exchange</th>
                  <th>Pointer</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item, index) => {
                  const rowNum =
                    pageSize === "ALL"
                      ? index + 1
                      : (currentPage - 1) * pageSize + index + 1;

                  const ptrBadgeClass = getPointerBadgeClass(item.pointer);
                  const ptrIcon = getPointerIcon(item.pointer);
                  const isSelected = selectedRowSymbol === item.symbol;

                  return (
                    <tr
                      key={item.symbol || index}
                      className={`symbols-table-row pointer-table-row ${isSelected ? "row-selected-highlight" : ""}`}
                      onClick={() => handleRowClick(item)}
                      title={`Click to view Stock Analytics for ${stripSymbolSuffix(item.symbol)}`}
                    >
                      <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                        {String(rowNum).padStart(2, "0")}
                      </td>
                      <td>
                        <span className="symbol-ticker-badge">
                          <span>{stripSymbolSuffix(item.symbol)}</span>
                          <span style={{ fontSize: 11, opacity: 0.75 }}>↗</span>
                        </span>
                      </td>
                      <td>
                        {item.companyName ? (
                          <span className="symbol-company-name">{item.companyName}</span>
                        ) : (
                          <span className="symbol-company-placeholder">—</span>
                        )}
                      </td>
                      <td>
                        {item.indice ? (
                          <span className="symbol-index-pill active">{item.indice}</span>
                        ) : (
                          <span className="symbol-index-pill">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`symbol-exchange-badge ${getExchangeClass(item.exchange)}`}>
                          {item.exchange || "NSE"}
                        </span>
                      </td>
                      <td>
                        <span className={`pointer-scenario-badge ${ptrBadgeClass}`}>
                          {ptrIcon && <span className="ptr-icon">{ptrIcon}</span>}
                          <span>{item.pointer || "—"}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="symbols-pagination">
            <div className="symbols-page-info">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (
              {filteredData.length.toLocaleString()} total items)
            </div>
            <div className="symbols-page-btns">
              <button
                className="symbols-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First Page"
              >
                «
              </button>
              <button
                className="symbols-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Previous Page"
              >
                ‹
              </button>
              <button
                className="symbols-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Next Page"
              >
                ›
              </button>
              <button
                className="symbols-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
