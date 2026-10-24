import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./ScreenerPage.css";
import screenerService from "../../services/screenerService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { getConditionalActionDate } from "../../utils/dateUtils.js";
import { openStockAnalyticsInNewTab } from "../../utils/navigationUtils.js";

// Trigger options grouped by category
const TRIGGER_GROUPS = [
  {
    category: "Yellow Category",
    colorKey: "yellow",
    triggers: ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"],
    desc: "Breakout & Pivot Extensions",
  },
  {
    category: "Green Category",
    colorKey: "green",
    triggers: ["G1", "G2", "G3", "G4", "G5", "G6"],
    desc: "Rotation & Pullback Support Levels",
  },
  {
    category: "Red Category",
    colorKey: "red",
    triggers: ["R1", "R2", "R3", "R4", "R5", "R6"],
    desc: "Falling Channel & Breakdown Thresholds",
  },
];

const ALL_TRIGGERS = TRIGGER_GROUPS.flatMap((g) => g.triggers);

const CMP1_TIMEFRAMES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const CMP2_TIMEFRAMES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "5-YEARLY"];

const PATTERNS = [
  "Table Tennis",
  "Table Top",
  "Rising Jack",
  "Falling Duck",
  "Upward Rotation",
];

// Helper to format raw date into clean readable display (e.g. 16-Sep-2026)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  } catch {
    return String(dateStr);
  }
};

/**
 * Helper to compute CMP2 based on CMP1 according to the 4 comparison templates:
 * 1) if cmp1 timeframe = DAILY -> start and end date = previous week of the selected cmp1 date, timeframe = WEEKLY
 * 2) if cmp1 timeframe = WEEKLY -> start and end date = entire previous month, timeframe = MONTHLY
 * 3) if cmp1 timeframe = MONTHLY -> start and end date = entire previous year, timeframe = YEARLY
 * 4) if cmp1 timeframe = YEARLY -> start and end date = previous 5 years, timeframe = 5-YEARLY
 */
export function computeCmp2FromCmp1(cmp1DateStr, cmp1Tf) {
  const baseDate = cmp1DateStr ? new Date(cmp1DateStr) : new Date();
  const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const tf = String(cmp1Tf || "DAILY").toUpperCase();

  const formatDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  if (tf === "DAILY") {
    // 1) DAILY -> previous week (Monday to Friday) with timeframe WEEKLY
    const day = validDate.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    const diffToMonday = (day + 6) % 7;
    const prevWeekMonday = new Date(validDate);
    prevWeekMonday.setDate(validDate.getDate() - diffToMonday - 7);

    const prevWeekFriday = new Date(prevWeekMonday);
    prevWeekFriday.setDate(prevWeekMonday.getDate() + 4);

    return {
      startDate: formatDate(prevWeekMonday),
      endDate: formatDate(prevWeekFriday),
      timeframe: "WEEKLY",
    };
  } else if (tf === "WEEKLY") {
    // 2) WEEKLY -> entire previous month with timeframe MONTHLY
    const year = validDate.getFullYear();
    const month = validDate.getMonth(); // 0-indexed current month
    const prevMonthStart = new Date(year, month - 1, 1);
    const prevMonthEnd = new Date(year, month, 0);

    return {
      startDate: formatDate(prevMonthStart),
      endDate: formatDate(prevMonthEnd),
      timeframe: "MONTHLY",
    };
  } else if (tf === "MONTHLY") {
    // 3) MONTHLY -> entire previous calendar year with timeframe YEARLY
    const prevYear = validDate.getFullYear() - 1;
    const prevYearStart = new Date(prevYear, 0, 1);
    const prevYearEnd = new Date(prevYear, 11, 31);

    return {
      startDate: formatDate(prevYearStart),
      endDate: formatDate(prevYearEnd),
      timeframe: "YEARLY",
    };
  } else if (tf === "YEARLY") {
    // 4) YEARLY -> previous 5 years with timeframe 5-YEARLY
    const currentYear = validDate.getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear - 1;
    const fiveYearStart = new Date(startYear, 0, 1);
    const fiveYearEnd = new Date(endYear, 11, 31);

    return {
      startDate: formatDate(fiveYearStart),
      endDate: formatDate(fiveYearEnd),
      timeframe: "5-YEARLY",
    };
  }

  return {
    startDate: formatDate(new Date(Date.now() - 7 * 86400000)),
    endDate: formatDate(new Date()),
    timeframe: "WEEKLY",
  };
}

export default function ScreenerPage({
  onOpenStrategy,
  onOpenPointer,
  onOpenStockAnalytics,
  onBack,
  savedState,
  onSaveState,
}) {
  // Default helper dates: CMP1 defaults to conditional action date with Daily timeframe
  const today = getConditionalActionDate();
  const initialCmp2 = computeCmp2FromCmp1(today, "DAILY");

  // Market Filters State (Exchange & Index)
  const [selectedExchange, setSelectedExchange] = useState(savedState?.selectedExchange || "NSE");
  const [selectedIndice, setSelectedIndice] = useState(savedState?.selectedIndice || "ALL");
  const [availableExchanges, setAvailableExchanges] = useState(["ALL", "NSE", "BSE", "CRYPTO", "METALS"]);
  const [availableIndices, setAvailableIndices] = useState([]);

  // CMP1 (Current Market Period) State
  const [cmp1StartDate, setCmp1StartDate] = useState(savedState?.cmp1StartDate || getConditionalActionDate());
  const [cmp1EndDate, setCmp1EndDate] = useState(savedState?.cmp1EndDate || getConditionalActionDate());
  const [cmp1Timeframe, setCmp1Timeframe] = useState(savedState?.cmp1Timeframe || "DAILY");

  // CMP2 (Historical Reference Period) State (Pre-filled via template and fully editable)
  const [cmp2StartDate, setCmp2StartDate] = useState(savedState?.cmp2StartDate || initialCmp2.startDate);
  const [cmp2EndDate, setCmp2EndDate] = useState(savedState?.cmp2EndDate || initialCmp2.endDate);
  const [cmp2Timeframe, setCmp2Timeframe] = useState(savedState?.cmp2Timeframe || initialCmp2.timeframe);

  // Pattern & Multi-Trigger State - safely ensure array
  const initialTriggers = Array.isArray(savedState?.selectedTriggers)
    ? savedState.selectedTriggers
    : typeof savedState?.selectedTriggers === "string"
    ? savedState.selectedTriggers.split(",").map((s) => s.trim()).filter(Boolean)
    : ["Y1"];
  const [pattern, setPattern] = useState(savedState?.pattern || "Table Top");
  const [selectedTriggers, setSelectedTriggers] = useState(initialTriggers.length > 0 ? initialTriggers : ["Y1"]);

  // Results & Execution State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(savedState?.results || null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState(savedState?.searchQuery || "");
  const [copiedSymbol, setCopiedSymbol] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Sync state upward to parent (MainLayout) whenever key parameters or results change
  useEffect(() => {
    if (onSaveState) {
      onSaveState({
        selectedExchange,
        selectedIndice,
        cmp1StartDate,
        cmp1EndDate,
        cmp1Timeframe,
        cmp2StartDate,
        cmp2EndDate,
        cmp2Timeframe,
        pattern,
        selectedTriggers,
        results,
        searchQuery,
      });
    }
  }, [
    selectedExchange,
    selectedIndice,
    cmp1StartDate,
    cmp1EndDate,
    cmp1Timeframe,
    cmp2StartDate,
    cmp2EndDate,
    cmp2Timeframe,
    pattern,
    selectedTriggers,
    results,
    searchQuery,
    onSaveState,
  ]);

  // Handlers for updating CMP1 and automatically calculating CMP2 template values
  const handleCmp1TimeframeChange = (newTf) => {
    setCmp1Timeframe(newTf);
    const autoCmp2 = computeCmp2FromCmp1(cmp1EndDate || today, newTf);
    setCmp2StartDate(autoCmp2.startDate);
    setCmp2EndDate(autoCmp2.endDate);
    setCmp2Timeframe(autoCmp2.timeframe);
  };

  const handleCmp1DateChange = (newDate, isEnd = true) => {
    if (isEnd) {
      setCmp1EndDate(newDate);
      const autoCmp2 = computeCmp2FromCmp1(newDate, cmp1Timeframe);
      setCmp2StartDate(autoCmp2.startDate);
      setCmp2EndDate(autoCmp2.endDate);
      setCmp2Timeframe(autoCmp2.timeframe);
    } else {
      setCmp1StartDate(newDate);
    }
  };

  // Fetch metadata filters on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadFilters() {
      try {
        const metaRes = await stockService.getSymbolsMeta();
        if (!isCancelled && metaRes?.data) {
          if (Array.isArray(metaRes.data.exchanges) && metaRes.data.exchanges.length > 0) {
            setAvailableExchanges(["ALL", ...metaRes.data.exchanges]);
          }
          if (Array.isArray(metaRes.data.indices) && metaRes.data.indices.length > 0) {
            setAvailableIndices(metaRes.data.indices);
          }
        }
      } catch (err) {
        console.warn("Failed to load metadata in screener:", err);
      }
    }
    loadFilters();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Dynamic Index / Asset options based on selected exchange (e.g. Crypto, Metals)
  const dropdownIndexOptions = useMemo(() => {
    const ex = String(selectedExchange || "").toUpperCase();
    if (ex === "CRYPTO") {
      return [
        { value: "ALL", label: "All Crypto Assets" },
        { value: "DELTAIN:BTCUSD.P", label: "BTCUSD - Bitcoin Delta Perpetual" },
        { value: "DELTAIN:ETHUSD.P", label: "ETHUSD - Ethereum Delta Perpetual" },
        { value: "DELTAIN:SOLUSD.P", label: "SOLUSD - Solana Delta Perpetual" },
        { value: "DELTAIN:XRPUSD.P", label: "XRPUSD - XRP Delta Perpetual" },
        { value: "DELTAIN:XAUTUSD.P", label: "XAUTUSD - Gold (XAUT) Delta Perpetual" },
        { value: "DELTAIN:PAXGUSD.P", label: "PAXGUSD - Paxos Gold Delta Perpetual" },
        { value: "DELTAIN:SLVONUSD.P", label: "SLVONUSD - Silver Delta Perpetual" },
      ];
    }
    if (ex === "METALS") {
      return [
        { value: "ALL", label: "All Metals Assets" },
        { value: "OANDA:XAUUSD", label: "XAUUSD - Gold / US Dollar (OANDA)" },
        { value: "OANDA:XAGUSD", label: "XAGUSD - Silver / US Dollar (OANDA)" },
      ];
    }

    const rawIndices = Array.isArray(availableIndices) && availableIndices.length > 0
      ? availableIndices
      : [];

    const stringIndices = rawIndices
      .map((item) => (typeof item === "object" && item !== null ? item.value || item.name || item.label : String(item || "")))
      .filter(Boolean);

    if (ex === "NSE" || ex === "BSE") {
      const filtered = stringIndices.filter(
        (i) => i.toLowerCase() !== "crypto" && i.toLowerCase() !== "metals" && i.toUpperCase() !== "ALL"
      );
      return [
        { value: "ALL", label: "All Indices" },
        ...filtered.map((idx) => ({ value: idx, label: idx })),
      ];
    }
    const nonAll = stringIndices.filter((i) => i.toUpperCase() !== "ALL");
    return [
      { value: "ALL", label: "All Indices & Assets" },
      ...nonAll.map((idx) => ({ value: idx, label: idx })),
    ];
  }, [selectedExchange, availableIndices]);

  const handleExchangeChange = (newEx) => {
    setSelectedExchange(newEx);
    setSelectedIndice("ALL");
  };

  // Toggle individual trigger in/out of selection
  const handleToggleTrigger = (trig) => {
    setSelectedTriggers((prev) => {
      const arr = Array.isArray(prev) ? prev : ["Y1"];
      if (arr.includes(trig)) {
        const updated = arr.filter((t) => t !== trig);
        return updated.length > 0 ? updated : ["Y1"];
      } else {
        return [...arr, trig];
      }
    });
  };

  // Toggle entire category
  const handleToggleCategory = (catTriggers) => {
    const list = Array.isArray(catTriggers) ? catTriggers : [];
    setSelectedTriggers((prev) => {
      const arr = Array.isArray(prev) ? prev : ["Y1"];
      const allSelected = list.every((t) => arr.includes(t));
      if (allSelected) {
        const remaining = arr.filter((t) => !list.includes(t));
        return remaining.length > 0 ? remaining : ["Y1"];
      } else {
        return Array.from(new Set([...arr, ...list]));
      }
    });
  };

  // Select all available triggers
  const handleSelectAllTriggers = () => {
    setSelectedTriggers(ALL_TRIGGERS);
  };

  // Reset to single default trigger
  const handleResetTriggers = () => {
    setSelectedTriggers(["Y1"]);
  };

  // Handle Form Submission
  const handleGenerateReport = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      exchange: selectedExchange,
      indice: selectedIndice,
      cmp1: {
        startDate: cmp1StartDate,
        endDate: cmp1EndDate,
        timeframe: cmp1Timeframe,
      },
      cmp2: {
        startDate: cmp2StartDate,
        endDate: cmp2EndDate,
        timeframe: cmp2Timeframe,
      },
      pattern,
      triggers: selectedTriggers,
      trigger: selectedTriggers.join(", "),
    };

    try {
      const response = await screenerService.runScreener(payload);
      if (response?.results) {
        setResults(response);
      } else {
        setResults({ results: [], count: 0 });
      }
    } catch (err) {
      setError(err.message || "Failed to generate breakout report.");
    } finally {
      setLoading(false);
    }
  };

  // Lookup details for a symbol if provided by backend
  const detailsMap = React.useMemo(() => {
    const map = {};
    if (results?.details && Array.isArray(results.details)) {
      results.details.forEach((d) => {
        if (d?.symbol) map[d.symbol] = d;
      });
    }
    return map;
  }, [results]);

  // Filter results by search query (matches raw/clean symbol or matched trigger)
  const filteredSymbols = results?.results
    ? results.results.filter((sym) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        if (sym.toLowerCase().includes(q) || stripSymbolSuffix(sym).toLowerCase().includes(q)) return true;
        const detail = detailsMap[sym];
        if (detail?.matchedTriggers?.some((m) => m.trigger.toLowerCase().includes(q))) return true;
        return false;
      })
    : [];

  const handleCopySymbol = (sym) => {
    const textToCopy = stripSymbolSuffix(sym);
    navigator.clipboard?.writeText(textToCopy);
    setCopiedSymbol(textToCopy);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  const handleCopyAll = () => {
    if (!results?.results || results.results.length === 0) return;
    const cleanList = results.results.map((s) => stripSymbolSuffix(s));
    navigator.clipboard?.writeText(cleanList.join(", "));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportResultsExcel = async () => {
    if (!results?.results || results.results.length === 0) return;
    try {
      setIsExportingExcel(true);
      await screenerService.exportResultsExcel({
        results: results.results,
        details: results.details || [],
        date: cmp1EndDate || today,
        triggers: selectedTriggers,
      });
    } catch (err) {
      console.error("Failed to export results to excel:", err);
      alert(`Failed to export breakout results to Excel: ${err.message || "Server error"}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const [downloadingExcelSymbol, setDownloadingExcelSymbol] = useState(null);

  const handleDownloadStrategyExcel = async (symbol, detail) => {
    try {
      setDownloadingExcelSymbol(symbol);
      const stockDate = detail?.date || detail?.cmp1Date || cmp1EndDate || today;
      await screenerService.downloadStrategyExcel({
        symbol,
        open: detail?.open,
        high: detail?.high,
        low: detail?.low,
        close: detail?.close || detail?.cmp1Close,
        average: detail?.average,
        range: detail?.range,
        date: stockDate,
        timeframe: cmp2Timeframe || "Daily",
      });
    } catch (err) {
      console.error("Failed to generate strategy sheet:", err);
      alert(`Failed to generate strategy spreadsheet for ${symbol}: ${err.message || "Server error"}`);
    } finally {
      setDownloadingExcelSymbol(null);
    }
  };

  // Helper to color-code trigger badges
  const getTriggerClass = (trig) => {
    if (trig.startsWith("Y")) return "trigger-badge-yellow";
    if (trig.startsWith("G")) return "trigger-badge-green";
    if (trig.startsWith("R")) return "trigger-badge-red";
    return "";
  };

  return (
    <div className="screener-page-wrapper">
      {onBack && (
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#334155",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "all 0.15s ease",
            }}
          >
            ← Back to Report Cards
          </button>
        </div>
      )}

      {/* CONTROLS FORM */}
      <form className="screener-form" onSubmit={handleGenerateReport}>
        {/* MARKET & PATTERN SETUP BAR */}
        <div className="screener-card pattern-card">
          <div className="card-header-badge pattern-badge">
            <span className="badge-icon">🌐</span>
            <span>Market &amp; Pattern Setup</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              width: "100%",
            }}
          >
            <div className="screener-input-group">
              <label className="input-label">Exchange</label>
              <select
                className="apple-select-input"
                value={selectedExchange}
                onChange={(e) => handleExchangeChange(e.target.value)}
              >
                {availableExchanges.map((ex) => (
                  <option key={`ex-${ex}`} value={ex}>
                    {ex === "ALL" ? "All Exchanges (NSE, BSE, Crypto, Metals)" : ex}
                  </option>
                ))}
              </select>
            </div>

            <div className="screener-input-group">
              <label className="input-label">
                {selectedExchange === "CRYPTO"
                  ? "Crypto Asset"
                  : selectedExchange === "METALS"
                  ? "Metals Asset"
                  : "Index / Sector"}
              </label>
              <select
                className="apple-select-input"
                value={selectedIndice}
                onChange={(e) => setSelectedIndice(e.target.value)}
              >
                {dropdownIndexOptions.map((opt) => (
                  <option key={`idx-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Pointer Pattern Type</label>
              <select
                className="apple-select-input pattern-select"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              >
                {PATTERNS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE 3-COLUMN GRID: CMP1, CMP2, TRIGGER SELECTOR */}
        <div className="screener-three-column-grid">
          {/* 1. CMP1 CARD */}
          <div className="screener-card cmp1-card">
            <div className="card-header-badge cmp1-badge">
              <span className="badge-icon">📍</span>
              <span>CMP1 (Current Market)</span>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp1StartDate}
                onChange={(e) => handleCmp1DateChange(e.target.value, false)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">End Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp1EndDate}
                onChange={(e) => handleCmp1DateChange(e.target.value, true)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">Timeframe</label>
              <select
                className="apple-select-input"
                value={cmp1Timeframe}
                onChange={(e) => handleCmp1TimeframeChange(e.target.value)}
              >
                {CMP1_TIMEFRAMES.map((tf) => (
                  <option key={`cmp1-${tf}`} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. CMP2 CARD (Historical Reference) */}
          <div className="screener-card cmp2-card">
            <div className="card-header-badge cmp2-badge">
              <span className="badge-icon">🏛️</span>
              <span>CMP2 (Historical Ref)</span>
            </div>

            <div className="screener-input-group">
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp2StartDate}
                onChange={(e) => setCmp2StartDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">End Date</label>
              <input
                type="date"
                className="apple-date-input"
                value={cmp2EndDate}
                onChange={(e) => setCmp2EndDate(e.target.value)}
                required
              />
            </div>

            <div className="screener-input-group">
              <label className="input-label">Timeframe</label>
              <select
                className="apple-select-input"
                value={cmp2Timeframe}
                onChange={(e) => setCmp2Timeframe(e.target.value)}
              >
                {CMP2_TIMEFRAMES.map((tf) => (
                  <option key={`cmp2-${tf}`} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. MULTI-TRIGGER SELECTOR CARD (Side-by-side) */}
          <div className="screener-card trigger-card">
            <div className="trigger-card-header">
              <div className="card-header-badge trigger-badge">
                <span className="badge-icon">🎯</span>
                <span>Trigger Breakout Levels</span>
              </div>

              {/* Quick Actions Bar */}
              <div className="trigger-quick-actions">
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={handleSelectAllTriggers}
                  title="Select all triggers"
                >
                  ✓ All
                </button>
                <button
                  type="button"
                  className="quick-action-pill yellow-pill-action"
                  onClick={() => handleToggleCategory(["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"])}
                >
                  + Y
                </button>
                <button
                  type="button"
                  className="quick-action-pill green-pill-action"
                  onClick={() => handleToggleCategory(["G1", "G2", "G3", "G4", "G5", "G6"])}
                >
                  + G
                </button>
                <button
                  type="button"
                  className="quick-action-pill red-pill-action"
                  onClick={() => handleToggleCategory(["R1", "R2", "R3", "R4", "R5", "R6"])}
                >
                  + R
                </button>
                <button
                  type="button"
                  className="quick-action-pill reset-pill-action"
                  onClick={handleResetTriggers}
                  title="Reset to default trigger Y1"
                >
                  ↺ Y1
                </button>
              </div>
            </div>

            {/* Active Selection Chips Summary */}
            <div className="trigger-selection-summary">
              <div className="selected-chips-list">
                {selectedTriggers.map((trig) => (
                  <span key={`chip-${trig}`} className={`selected-chip ${getTriggerClass(trig)}`}>
                    <strong>{trig}</strong>
                    {selectedTriggers.length > 1 && (
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => handleToggleTrigger(trig)}
                        title={`Remove ${trig}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Compact Trigger Groups */}
            <div className="trigger-groups-wrapper compact-groups">
              {TRIGGER_GROUPS.map((group) => {
                const allCategorySelected = group.triggers.every((t) => selectedTriggers.includes(t));
                return (
                  <div key={group.category} className={`trigger-category-block ${group.colorKey}-block`}>
                    <div className="trigger-category-title">
                      <span className={`cat-pill ${group.colorKey}-pill`}>{group.category}</span>
                      <button
                        type="button"
                        className={`cat-toggle-btn ${allCategorySelected ? "cat-active" : ""}`}
                        onClick={() => handleToggleCategory(group.triggers)}
                      >
                        {allCategorySelected ? "Deselect" : "Select"}
                      </button>
                    </div>

                    <div className="trigger-buttons-grid">
                      {group.triggers.map((trig) => {
                        const isSelected = selectedTriggers.includes(trig);
                        return (
                          <button
                            key={trig}
                            type="button"
                            className={`trigger-btn ${group.colorKey}-btn ${isSelected ? "selected" : ""}`}
                            onClick={() => handleToggleTrigger(trig)}
                          >
                            <span className="trigger-name">{trig}</span>
                            {isSelected && <span className="selected-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SUBMIT ACTION BUTTON */}
        <div className="screener-action-container">
          <button
            type="submit"
            className={`generate-report-btn ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                <span>Screening Database...</span>
              </>
            ) : (
              <>
                <span>⚡ Generate Breakout Report</span>
                <span className="btn-badge-trigger">
                  {pattern} • {selectedTriggers.length} {selectedTriggers.length === 1 ? "Trigger" : "Triggers"} (
                  {selectedTriggers.slice(0, 4).join(", ")}
                  {selectedTriggers.length > 4 ? ` +${selectedTriggers.length - 4}` : ""})
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ERROR BANNER */}
      {error && (
        <div className="screener-error-banner">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* RESULTS DATA TABLE SECTION */}
      {results && (
        <div className="screener-card results-card">
          <div className="results-header">
            <div className="results-title-group">
              <span className="results-badge">RESULTS REPORT</span>
              <h2 className="results-heading">Qualifying Breakout Stocks</h2>
              <span className="results-count-pill">
                {results.count} {results.count === 1 ? "Stock" : "Stocks"} Found
              </span>
              <span className="results-trigger-summary-pill">
                Compared: {selectedTriggers.join(", ")}
              </span>
            </div>

            <div className="results-actions">
              <div className="search-box-wrapper">
                <input
                  type="text"
                  placeholder="Filter symbols or triggers..."
                  className="results-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="action-pill-btn export-excel-btn"
                onClick={handleExportResultsExcel}
                disabled={isExportingExcel || results.results.length === 0}
                title="Download Excel sheet containing all results with [STOCK NAME, DATE, MATCHED BREAKOUT TRIGGERS, CMP1 CLOSE]"
              >
                {isExportingExcel ? "⏳ Exporting..." : "📥 Download Results (.xlsx)"}
              </button>

              <button
                type="button"
                className="action-pill-btn"
                onClick={handleCopyAll}
                disabled={results.results.length === 0}
              >
                {copiedAll ? "✓ Copied All" : "📋 Copy All Symbols"}
              </button>
            </div>
          </div>

          {/* TABLE */}
          {filteredSymbols.length > 0 ? (
            <div className="results-table-wrapper">
              <table className="screener-table">
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    <th className="col-stock-name">STOCK NAME</th>
                    <th className="col-date">DATE</th>
                    <th className="col-breakout-triggers">MATCHED BREAKOUT TRIGGERS</th>
                    <th className="col-cmp1-close">CMP1 CLOSE</th>
                    <th className="col-action">QUICK ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSymbols.map((symbol, index) => {
                    const detail = detailsMap[symbol];
                    const matched = detail?.matchedTriggers || [];
                    const cmp1Close = detail?.cmp1Close;
                    const stockDate = detail?.date || detail?.cmp1Date || cmp1EndDate;

                    return (
                      <tr key={symbol} className="screener-row">
                        <td className="col-idx">{index + 1}</td>
                        <td className="col-stock-name">
                          <div
                            className="stock-name-cell clickable-stock"
                            onClick={() => {
                              openStockAnalyticsInNewTab({
                                symbol,
                                exchange: detail?.exchange || selectedExchange || "ALL",
                                indice: detail?.indice || selectedIndice || "ALL",
                                timeframe: "Daily",
                                highlightDate: stockDate,
                              });
                            }}
                            title="Click to view Stock Analytics in new tab"
                          >
                            <span className="stock-symbol-badge link-badge">{stripSymbolSuffix(symbol)}</span>
                            {detail?.exchange && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background:
                                    detail.exchange === "CRYPTO"
                                      ? "#ede9fe"
                                      : detail.exchange === "METALS"
                                      ? "#fef3c7"
                                      : "#e0f2fe",
                                  color:
                                    detail.exchange === "CRYPTO"
                                      ? "#6d28d9"
                                      : detail.exchange === "METALS"
                                      ? "#92400e"
                                      : "#0369a1",
                                  border: "1px solid currentColor",
                                  opacity: 0.9,
                                }}
                              >
                                {detail.exchange}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-date">
                          <span className="results-date-badge">{formatDateDisplay(stockDate)}</span>
                        </td>
                        <td className="col-breakout-triggers">
                          <div className="matched-triggers-cell">
                            {matched.length > 0 ? (
                              matched.map((m) => {
                                const isNegative = m.pctBreakout < 0;
                                const isGGroup = String(m.trigger || "").toUpperCase().startsWith("G");
                                const sign = m.pctBreakout > 0 ? "+" : "";
                                return (
                                  <span
                                    key={`${symbol}-${m.trigger}`}
                                    className={`matched-trigger-tag ${getTriggerClass(m.trigger)}`}
                                    title={`Trigger Level: ₹${m.triggerPrice} (${sign}${m.pctBreakout}%)`}
                                  >
                                    <strong>{m.trigger}</strong>
                                    {m.triggerPrice && <span className="tag-price">@ ₹{m.triggerPrice}</span>}
                                    {m.pctBreakout !== undefined && (
                                      <span
                                        className={`tag-pct ${
                                          isNegative
                                            ? isGGroup
                                              ? "tag-pct-negative tag-pct-g-negative"
                                              : "tag-pct-negative"
                                            : "tag-pct-positive"
                                        }`}
                                      >
                                        {sign}{m.pctBreakout}%
                                      </span>
                                    )}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="breakout-match-tag">
                                Breakout Match ({selectedTriggers.join(", ")})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-cmp1-close">
                          <span className="cmp1-price-badge">
                            {cmp1Close !== undefined ? `₹${cmp1Close.toFixed(2)}` : "—"}
                          </span>
                        </td>
                        <td className="col-action">
                          <div className="row-action-btns">
                            <button
                              type="button"
                              className="mini-action-btn copy-btn"
                              onClick={() => handleCopySymbol(stripSymbolSuffix(symbol))}
                              title="Copy symbol to clipboard"
                            >
                              {copiedSymbol === stripSymbolSuffix(symbol) || copiedSymbol === symbol ? "✓ Copied" : "Copy"}
                            </button>

                            {/* <button
                              type="button"
                              className="mini-action-btn excel-strategy-btn"
                              onClick={() => handleDownloadStrategyExcel(symbol, detail)}
                              disabled={downloadingExcelSymbol === symbol}
                              title="Generate and Download Strategy Sheet (.xlsx) filled for this stock"
                            >
                              {downloadingExcelSymbol === symbol ? "⏳" : "📥 Strategy Sheet"}
                            </button> */}

                            {(onOpenStrategy || onOpenPointer) && (
                              <button
                                type="button"
                                className="mini-action-btn pointer-btn"
                                onClick={() => {
                                  const handler = onOpenStrategy || onOpenPointer;
                                  handler({
                                    symbol,
                                    script: stripSymbolSuffix(symbol),
                                    open: detail?.open,
                                    high: detail?.high,
                                    low: detail?.low,
                                    close: detail?.close || detail?.cmp1Close,
                                    cmp1Close: detail?.cmp1Close,
                                    range: detail?.range,
                                    average: detail?.average,
                                    timeframe: cmp2Timeframe || "Daily",
                                    title: `${stripSymbolSuffix(symbol)} - Strategy Decision Matrix`,
                                  });
                                }}
                                title="Open in Strategy Decision Matrix"
                              >
                                View →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-results-state">
              <div className="no-results-icon">🔍</div>
              <h3>No Stocks Matched the Breakout Filter</h3>
              <p>
                No stocks had CMP1 Close &gt; CMP2 Trigger ({selectedTriggers.join(", ")}) for {pattern}. Try selecting additional trigger levels or adjusting the period dates.
              </p>
            </div>
          )}
        </div>
      )}

      {/* INITIAL PROMPT WHEN NO SEARCH EXECUTED YET */}
      {!results && !loading && (
        <div className="screener-empty-prompt">
          <div className="prompt-icon">📊</div>
          <h3>Ready to Scan Market</h3>
          <p>
            Configure CMP1 vs CMP2, select one or multiple breakout triggers (Y1–Y6, G1–G6, R1–R5), and click <strong>Generate Breakout Report</strong> to compare stocks across levels.
          </p>
        </div>
      )}
    </div>
  );
}

