import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./SymbolsPage.css";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import SearchableSelect from "../Common/SearchableSelect.jsx";

export default function SymbolsPage({ onSelectSymbol }) {
  // Filter States
  const [exchange, setExchange] = useState("ALL");
  const [indice, setIndice] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Data & Metadata States
  const [symbols, setSymbols] = useState([]);
  const [meta, setMeta] = useState({
    exchanges: ["NSE", "BSE"],
    indices: [],
    totalSymbols: 0,
  });
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

  const pageSizeOptions = useMemo(() => [
    { value: 25, label: "25" },
    { value: 50, label: "50" },
    { value: 100, label: "100" },
    { value: 200, label: "200" },
    { value: "ALL", label: "All" },
  ], []);

  // 1. Fetch Metadata (exchanges, indices, count) on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadMeta() {
      try {
        const res = await stockService.getSymbolsMeta();
        if (!isCancelled && res?.data) {
          setMeta({
            exchanges: res.data.exchanges || ["NSE", "BSE"],
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

  // 2. Fetch Symbols based on selected Exchange / Indice
  const fetchSymbols = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await stockService.getSymbolsList({
        exchange: exchange !== "ALL" ? exchange : undefined,
        indice: indice !== "ALL" ? indice : undefined,
        limit: "all",
      });

      if (res?.data && Array.isArray(res.data)) {
        setSymbols(res.data);
      } else {
        setSymbols([]);
      }
      setCurrentPage(1);
    } catch (err) {
      console.error("Error fetching symbols metadata:", err);
      setError(err.message || "Failed to load symbols from server.");
      setSymbols([]);
    } finally {
      setLoading(false);
    }
  }, [exchange, indice]);

  useEffect(() => {
    fetchSymbols();
  }, [fetchSymbols]);

  // Client-side search filtering across symbol, company_name, and indice
  const filteredSymbols = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) {
      return symbols;
    }
    const term = searchTerm.trim().toLowerCase();
    return symbols.filter((item) => {
      const symMatch = item.symbol && item.symbol.toLowerCase().includes(term);
      const compMatch = item.company_name && item.company_name.toLowerCase().includes(term);
      const indMatch = item.indice && item.indice.toLowerCase().includes(term);
      const exMatch = item.exchange && item.exchange.toLowerCase().includes(term);
      return symMatch || compMatch || indMatch || exMatch;
    });
  }, [symbols, searchTerm]);

  // Pagination calculation
  const totalItems = filteredSymbols.length;
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(totalItems / pageSize);
  const paginatedSymbols = useMemo(() => {
    if (pageSize === "ALL") return filteredSymbols;
    const start = (currentPage - 1) * pageSize;
    return filteredSymbols.slice(start, start + pageSize);
  }, [filteredSymbols, currentPage, pageSize]);

  const handleRowClick = (item) => {
    if (onSelectSymbol) {
      onSelectSymbol(item);
    }
  };

  const handleClearFilters = () => {
    setExchange("ALL");
    setIndice("ALL");
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

  return (
    <div className="symbols-page-container">
      {/* Header Banner */}
      <div className="symbols-header-card">
        <div className="symbols-header-left">
          <div className="symbols-header-badge">
            <span>🏛️</span>
            <span>Aarambh Tradex Directory</span>
          </div>
          <h1 className="symbols-header-title">Symbols &amp; Instruments</h1>
          <p className="symbols-header-sub">
            Browse listed equities and instruments. Click on any symbol to launch deep Stock Analytics.
          </p>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="symbols-stats-row">
        <div className="symbols-stat-card">
          <div className="symbols-stat-icon blue">📈</div>
          <div className="symbols-stat-info">
            <span className="symbols-stat-value">
              {meta.totalSymbols ? meta.totalSymbols.toLocaleString() : symbols.length.toLocaleString()}
            </span>
            <span className="symbols-stat-label">Total Symbols</span>
          </div>
        </div>

        <div className="symbols-stat-card">
          <div className="symbols-stat-icon indigo">🏛️</div>
          <div className="symbols-stat-info">
            <span className="symbols-stat-value">{meta.exchanges.length || 2}</span>
            <span className="symbols-stat-label">Exchanges</span>
          </div>
        </div>

        <div className="symbols-stat-card">
          <div className="symbols-stat-icon emerald">📑</div>
          <div className="symbols-stat-info">
            <span className="symbols-stat-value">{meta.indices.length || "30+"}</span>
            <span className="symbols-stat-label">Indices Tracked</span>
          </div>
        </div>

        <div className="symbols-stat-card">
          <div className="symbols-stat-icon amber">🎯</div>
          <div className="symbols-stat-info">
            <span className="symbols-stat-value">{filteredSymbols.length.toLocaleString()}</span>
            <span className="symbols-stat-label">Matching Results</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="symbols-toolbar">
        <div className="symbols-toolbar-left">
          {/* Search Input */}
          <div className="symbols-search-wrap">
            <span className="symbols-search-icon">🔍</span>
            <input
              type="text"
              className="symbols-search-input"
              placeholder="Search by Symbol, Company Name, or Index..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                className="symbols-search-clear"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Exchange Filter */}
          <div className="symbols-select-wrap">
            <label className="symbols-select-label">Exchange:</label>
            <SearchableSelect
              options={exchangeOptions}
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              compact
              style={{ minWidth: 150 }}
            />
          </div>

          {/* Indice Filter */}
          <div className="symbols-select-wrap">
            <label className="symbols-select-label">Index:</label>
            <SearchableSelect
              options={indiceOptions}
              value={indice}
              onChange={(e) => setIndice(e.target.value)}
              compact
              style={{ minWidth: 220 }}
            />
          </div>
        </div>

        <div className="symbols-toolbar-right">
          {(exchange !== "ALL" || indice !== "ALL" || searchTerm) && (
            <button
              className="symbols-btn symbols-btn-ghost"
              onClick={handleClearFilters}
              title="Reset all filters"
            >
              <span>↺</span> Reset Filters
            </button>
          )}

          <button
            className="symbols-btn symbols-btn-primary"
            onClick={fetchSymbols}
            title="Refresh symbols from database"
          >
            <span>⚡</span> Refresh
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="symbols-table-card">
        <div className="symbols-table-header-info">
          <div>
            Showing <span className="symbols-count-highlight">{filteredSymbols.length}</span> symbols
            {exchange !== "ALL" ? ` on ${exchange}` : ""}
            {indice !== "ALL" ? ` in ${indice}` : ""}
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
            <div className="symbols-state-title">Loading Symbols Metadata...</div>
            <div className="symbols-state-desc">
              Connecting to Aarambh Tradex database to retrieve all registered instruments.
            </div>
          </div>
        ) : error ? (
          <div className="symbols-state-box">
            <span style={{ fontSize: 36, marginBottom: 12 }}>⚠️</span>
            <div className="symbols-state-title">Error Loading Symbols</div>
            <div className="symbols-state-desc">{error}</div>
            <button className="symbols-btn symbols-btn-primary" onClick={fetchSymbols}>
              Retry Connection
            </button>
          </div>
        ) : filteredSymbols.length === 0 ? (
          <div className="symbols-state-box">
            <span style={{ fontSize: 36, marginBottom: 12 }}>🔍</span>
            <div className="symbols-state-title">No Symbols Found</div>
            <div className="symbols-state-desc">
              No matching instruments found for your current filter and search criteria.
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
                  {/* <th style={{ width: 140, textAlign: "center" }}>Action</th> */}
                </tr>
              </thead>
              <tbody>
                {paginatedSymbols.map((item, index) => {
                  const rowNum =
                    pageSize === "ALL"
                      ? index + 1
                      : (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={item.id || item.symbol || index}
                      className="symbols-table-row"
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
                        {item.company_name ? (
                          <span className="symbol-company-name">{item.company_name}</span>
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
                      {/* <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="symbol-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(item);
                          }}
                        >
                          <span>Analyze</span>
                          <span>📊</span>
                        </button>
                      </td> */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="symbols-pagination">
            <div className="symbols-pagination-info">
              Showing{" "}
              <strong>
                {pageSize === "ALL" ? 1 : (currentPage - 1) * pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {pageSize === "ALL" ? totalItems : Math.min(currentPage * pageSize, totalItems)}
              </strong>{" "}
              of <strong>{totalItems.toLocaleString()}</strong> symbols
            </div>

            <div className="symbols-pagination-controls">
              <button
                className="symbols-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                « First
              </button>
              <button
                className="symbols-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ‹ Prev
              </button>

              <span style={{ fontSize: 13, fontWeight: 600, padding: "0 8px" }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                className="symbols-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next ›
              </button>
              <button
                className="symbols-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
