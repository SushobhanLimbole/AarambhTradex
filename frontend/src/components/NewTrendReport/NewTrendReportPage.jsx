import React, { useState, useEffect, useCallback } from "react";
import "./NewTrendReportPage.css";
import trendReportService from "../../services/trendReportService.js";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

const TIMEFRAMES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

// Preset indices matching screenshot exactly with default stock counts
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

export default function NewTrendReportPage({ onOpenStrategy, onOpenPointer, onBack }) {
  const [exchange, setExchange] = useState("NSE");
  const [indexVal, setIndexVal] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("Daily");
  const [actionDate, setActionDate] = useState("");
  const [mode, setMode] = useState("set1"); // 'set1' (RUN) or 'set2' (ADV)
  
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
            // Merge live indices with preset indices
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

            // Add any extra indices from DB not in presets
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
          } else if (Array.isArray(res.data.indices) && res.data.indices.length > 0) {
            const dynamicList = res.data.indices.map((idx) => ({
              value: idx,
              label: `${idx.toUpperCase()} (${idx.length * 2} stocks)`,
              count: 0,
            }));
            setIndexOptions(dynamicList);
          }
        }
      } catch (e) {
        console.warn("Meta load:", e);
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

  // Load initial scan
  useEffect(() => {
    handleRunScan("set1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchange, indexVal, timeframe]);

  return (
    <div className="new-trend-report-wrapper">
      {/* TOP CONTROL TOOLBAR (MATCHING SCREENSHOT 1) */}
      <div className="ntr-top-toolbar">
        {onBack && (
          <button
            type="button"
            className="ntr-back-btn"
            onClick={onBack}
            title="Return to 8 Report Cards Hub"
          >
            ← Back to Report Cards
          </button>
        )}

        <div className="ntr-title-brand">
          <span className="ntr-logo-icon">📈</span>
          <span className="ntr-brand-text">New Trend Scanner</span>
        </div>

        {/* EXCHANGE */}
        <div className="ntr-control-item">
          <label className="ntr-label">Exchange</label>
          <select
            className="ntr-select"
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

        {/* INDEX WITH EXACT "NAME (X STOCKS)" FORMAT */}
        <div className="ntr-control-item ntr-wide-item">
          <label className="ntr-label">Index</label>
          <select
            className="ntr-select"
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
          >
            <option value="ALL">ALL (All Stocks)</option>
            {indexOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* TIMEFRAME */}
        <div className="ntr-control-item">
          <label className="ntr-label">Timeframe</label>
          <select
            className="ntr-select"
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

        {/* ACTION DATE */}
        <div className="ntr-control-item">
          <label className="ntr-label">Action Date</label>
          <input
            type="date"
            className="ntr-input"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
          />
        </div>

        {/* ACTION BUTTONS (RUN SET#1 & ADV SET#2) */}
        <div className="ntr-btn-group">
          <button
            type="button"
            className={`ntr-btn ntr-btn-run ${mode === "set1" ? "active" : ""}`}
            onClick={() => handleRunScan("set1")}
            disabled={loading}
          >
            <span className="ntr-btn-main">RUN</span>
            <span className="ntr-btn-sub">SET #1</span>
          </button>

          <button
            type="button"
            className={`ntr-btn ntr-btn-adv ${mode === "set2" ? "active" : ""}`}
            onClick={() => handleRunScan("set2")}
            disabled={loading}
            title="Advanced Multi-Timeframe Trend Alignment Filter"
          >
            <span className="ntr-btn-main">ADV</span>
            <span className="ntr-btn-sub">SET #2</span>
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="ntr-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* SUMMARY STATS BAR */}
      <div className="ntr-stats-bar">
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">Total Stocks:</span>
          <span className="ntr-stat-val">{stats.total}</span>
        </div>
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">Up-Trends:</span>
          <span className="ntr-stat-val text-green">{stats.upTrends}</span>
        </div>
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">Down-Trends:</span>
          <span className="ntr-stat-val text-red">{stats.downTrends}</span>
        </div>
        <div className="ntr-stat-item">
          <span className="ntr-stat-label">High Power:</span>
          <span className="ntr-stat-val text-blue">{stats.highPower}</span>
        </div>
        <div className="ntr-stat-badge">
          <span>HLC HIGHER / LOWER • FOR ALL TIMEFRAMES</span>
        </div>
      </div>

      {/* DATA TABLE (MATCHING SCREENSHOT 1 & 2) */}
      <div className="ntr-table-card">
        <div className="ntr-table-scroll">
          <table className="ntr-table">
            <thead>
              <tr>
                <th className="th-sr">SR.</th>
                <th className="th-ticker">TICKER</th>
                <th className="th-trend">CURR TREND</th>
                <th className="th-date">TREND DATE</th>
                <th className="th-area">AREA</th>
                <th className="th-slot">SLOT</th>
                <th className="th-power">POWER</th>
                <th className="th-htrltr">HTR-LTR</th>
                <th className="th-htftrend">HTF TREND</th>
                <th className="th-htfdate">HTF TREND DATE</th>
                <th className="th-htfarea">HTF AREA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="ntr-empty-cell">
                    <div className="ntr-loading-box">
                      <span className="ntr-spinner">⏳</span>
                      <span>Calculating HLC Higher &amp; Lower Trend Scanner Matrices...</span>
                    </div>
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="ntr-empty-cell">
                    <div className="ntr-loading-box">
                      <span className="ntr-spinner">📊</span>
                      <span>No trend records matched the criteria. Click RUN SET #1 to scan all symbols.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => {
                  const cleanSym = stripSymbolSuffix(row.symbol);
                  const isUpTrend = row.currTrend === "UP-TREND";
                  const isDownTrend = row.currTrend === "DOWN-TREND";

                  const isHtfUp = row.htfTrend === "UP-TREND";
                  const isHtfDown = row.htfTrend === "DOWN-TREND";

                  return (
                    <tr key={row.symbol || idx} className="ntr-row">
                      {/* SR */}
                      <td className="td-sr">{idx + 1}</td>

                      {/* TICKER */}
                      <td className="td-ticker">
                        <span
                          className="ticker-pill-link"
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
                          title={`Click to open ${cleanSym} Strategy & Pointer matrix`}
                        >
                          {cleanSym}
                        </span>
                      </td>

                      {/* CURR TREND */}
                      <td className="td-trend">
                        {isUpTrend && <div className="trend-badge badge-green">UP-TREND</div>}
                        {isDownTrend && <div className="trend-badge badge-red">DOWN-TREND</div>}
                        {!isUpTrend && !isDownTrend && <span className="ntr-muted">—</span>}
                      </td>

                      {/* TREND DATE */}
                      <td className="td-date">{row.trendDate || "—"}</td>

                      {/* AREA */}
                      <td className="td-area">
                        {row.area === "GREEN" && <span className="area-text area-green">GREEN</span>}
                        {row.area === "RED" && <span className="area-text area-red">RED</span>}
                      </td>

                      {/* SLOT */}
                      <td className="td-slot">
                        {row.slot === "HIGHER" && <span className="slot-text slot-higher">HIGHER</span>}
                        {row.slot === "LOWER" && <span className="slot-text slot-lower">LOWER</span>}
                      </td>

                      {/* POWER */}
                      <td className="td-power">
                        {row.power === "HIGH" && <span className="power-text power-high">HIGH</span>}
                        {row.power === "LOW" && <span className="power-text power-low">LOW</span>}
                      </td>

                      {/* HTR-LTR */}
                      <td className="td-htrltr">
                        <span className="htrltr-text">{row.htrLtr || "—"}</span>
                      </td>

                      {/* HTF TREND */}
                      <td className="td-htftrend">
                        {isHtfUp && <div className="trend-badge badge-green">UP-TREND</div>}
                        {isHtfDown && <div className="trend-badge badge-red">DOWN-TREND</div>}
                        {!isHtfUp && !isHtfDown && <span className="ntr-muted">—</span>}
                      </td>

                      {/* HTF TREND DATE */}
                      <td className="td-htfdate">{row.htfTrendDate || "—"}</td>

                      {/* HTF AREA */}
                      <td className="td-htfarea">
                        {row.htfArea === "GREEN" && <span className="area-text area-green">GREEN</span>}
                        {row.htfArea === "RED" && <span className="area-text area-red">RED</span>}
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
