import React, { useState, useEffect } from "react";
import "./DataSyncPage.css";
import eodSyncService from "../../services/eodSyncService";
import Toast from "../Common/Toast";

export default function DataSyncPage() {
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Form states for manual triggers
  const [indianDate, setIndianDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [indianLimit, setIndianLimit] = useState("");
  const [syncingIndian, setSyncingIndian] = useState(false);

  const [globalDate, setGlobalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [syncingGlobal, setSyncingGlobal] = useState(false);

  const [reconcileDays, setReconcileDays] = useState(30);
  const [reconcileLimit, setReconcileLimit] = useState("");
  const [syncingReconcile, setSyncingReconcile] = useState(false);

  // Results display
  const [lastSyncResult, setLastSyncResult] = useState(null);

  useEffect(() => {
    fetchStatus();
    // Poll status every 15 seconds
    const timer = setInterval(fetchStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await eodSyncService.getStatus();
      if (res && res.data) {
        setStatusData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleTriggerIndian = async (e) => {
    e.preventDefault();
    setSyncingIndian(true);
    setToast({ message: "Starting Indian Market EOD Sync...", type: "info" });
    try {
      const res = await eodSyncService.triggerIndianSync({
        date: indianDate,
        limit: indianLimit ? Number(indianLimit) : undefined,
      });
      setLastSyncResult({
        type: "Indian Market EOD Sync",
        timestamp: new Date().toLocaleTimeString(),
        data: res.data,
      });
      setToast({
        message: `Indian EOD Sync completed! ${res.data?.syncedCount || 0} symbols updated.`,
        type: "success",
      });
      fetchStatus();
    } catch (err) {
      setToast({ message: err.message || "Indian EOD Sync failed.", type: "error" });
    } finally {
      setSyncingIndian(false);
    }
  };

  const handleTriggerGlobal = async (e) => {
    e.preventDefault();
    setSyncingGlobal(true);
    setToast({ message: "Starting Global Assets EOD Sync...", type: "info" });
    try {
      const res = await eodSyncService.triggerGlobalSync({
        date: globalDate,
      });
      setLastSyncResult({
        type: "Global Assets EOD Sync",
        timestamp: new Date().toLocaleTimeString(),
        data: res.data,
      });
      setToast({
        message: `Global Assets Sync completed! ${res.data?.syncedCount || 0} assets synced.`,
        type: "success",
      });
      fetchStatus();
    } catch (err) {
      setToast({ message: err.message || "Global Assets Sync failed.", type: "error" });
    } finally {
      setSyncingGlobal(false);
    }
  };

  const handleTriggerReconciliation = async (e) => {
    e.preventDefault();
    setSyncingReconcile(true);
    setToast({ message: "Starting Historical Data Reconciliation...", type: "info" });
    try {
      const res = await eodSyncService.triggerReconciliation({
        days: Number(reconcileDays) || 30,
        limit: reconcileLimit ? Number(reconcileLimit) : undefined,
      });
      setLastSyncResult({
        type: "Corporate Actions & Split Reconciliation",
        timestamp: new Date().toLocaleTimeString(),
        data: res.data,
      });
      setToast({
        message: `Reconciliation completed! ${res.data?.reconciledCount || 0} symbols adjusted.`,
        type: "success",
      });
      fetchStatus();
    } catch (err) {
      setToast({ message: err.message || "Reconciliation failed.", type: "error" });
    } finally {
      setSyncingReconcile(false);
    }
  };

  const jobs = statusData?.jobs || {};

  return (
    <div className="datasync-container">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />

      {/* Header */}
      <div className="datasync-header">
        <div>
          <h1 className="datasync-title">⚡ Market Data Synchronization Engine</h1>
          <p className="datasync-subtitle">
            Automated End-of-Day (EOD) ingestion, timezone-aware cron monitoring, and idempotent manual data triggers.
          </p>
        </div>

        <div className="datasync-header-actions">
          <button className="refresh-btn" onClick={fetchStatus} disabled={loadingStatus}>
            <span>🔄</span>
            <span>{loadingStatus ? "Refreshing..." : "Refresh Status"}</span>
          </button>
        </div>
      </div>

      {/* Cron Job Status Cards */}
      <div className="datasync-cards-grid">
        {/* Indian Market Job */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="status-card-title">🇮🇳 Indian Market EOD</span>
            <span className={`job-badge ${jobs.indian?.status || "IDLE"}`}>
              {jobs.indian?.status || "IDLE"}
            </span>
          </div>
          <div className="status-card-schedule">
            <span>⏰ Schedule:</span>
            <strong>{jobs.indian?.description || "5:30 PM IST (Mon-Fri)"}</strong>
          </div>
          <div className="status-card-metrics">
            <div className="metric-item">
              <span className="metric-label">Last Run</span>
              <span className="metric-val">
                {jobs.indian?.lastRun ? new Date(jobs.indian.lastRun).toLocaleTimeString() : "Pending"}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Synced</span>
              <span className="metric-val">{jobs.indian?.recordsUpdated || 0} symbols</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Duration</span>
              <span className="metric-val">
                {jobs.indian?.durationMs ? `${(jobs.indian.durationMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Assets Job */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="status-card-title">🌐 Global Assets EOD</span>
            <span className={`job-badge ${jobs.global?.status || "IDLE"}`}>
              {jobs.global?.status || "IDLE"}
            </span>
          </div>
          <div className="status-card-schedule">
            <span>⏰ Schedule:</span>
            <strong>{jobs.global?.description || "5:35 AM IST Daily"}</strong>
          </div>
          <div className="status-card-metrics">
            <div className="metric-item">
              <span className="metric-label">Last Run</span>
              <span className="metric-val">
                {jobs.global?.lastRun ? new Date(jobs.global.lastRun).toLocaleTimeString() : "Pending"}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Synced</span>
              <span className="metric-val">{jobs.global?.recordsUpdated || 0} records</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Duration</span>
              <span className="metric-val">
                {jobs.global?.durationMs ? `${(jobs.global.durationMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Reconciliation Job */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="status-card-title">🔄 Split & Action Reconciliation</span>
            <span className={`job-badge ${jobs.reconcile?.status || "IDLE"}`}>
              {jobs.reconcile?.status || "IDLE"}
            </span>
          </div>
          <div className="status-card-schedule">
            <span>⏰ Schedule:</span>
            <strong>{jobs.reconcile?.description || "2:00 AM IST Every Saturday"}</strong>
          </div>
          <div className="status-card-metrics">
            <div className="metric-item">
              <span className="metric-label">Last Run</span>
              <span className="metric-val">
                {jobs.reconcile?.lastRun ? new Date(jobs.reconcile.lastRun).toLocaleTimeString() : "Pending"}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Adjusted</span>
              <span className="metric-val">{jobs.reconcile?.recordsUpdated || 0} symbols</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Duration</span>
              <span className="metric-val">
                {jobs.reconcile?.durationMs ? `${(jobs.reconcile.durationMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Trigger Forms */}
      <div className="sync-panels-grid">
        {/* 1. Indian Market Trigger */}
        <div className="trigger-panel">
          <div className="trigger-panel-content">
            <h3 className="trigger-panel-title">🇮🇳 Indian Market Ingestion</h3>
            <p className="trigger-panel-desc">
              Fetch and upsert today's end-of-day candles for all active NSE and BSE equities with rate limiting.
            </p>

            <form className="trigger-form" onSubmit={handleTriggerIndian}>
              <div className="form-fields-wrap">
                <div className="form-group">
                  <label className="form-label">Target Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={indianDate}
                    onChange={(e) => setIndianDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Symbol Limit (Optional test batch)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 20 (leave blank for all 4,200+)"
                    value={indianLimit}
                    onChange={(e) => setIndianLimit(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="trigger-submit-btn"
                disabled={syncingIndian || jobs.indian?.status === "RUNNING"}
              >
                {syncingIndian ? "⏳ Ingesting Indian Equities..." : "🚀 Run Indian EOD Sync"}
              </button>
            </form>
          </div>
        </div>

        {/* 2. Global Assets Trigger */}
        <div className="trigger-panel">
          <div className="trigger-panel-content">
            <h3 className="trigger-panel-title">🌐 Global Assets Ingestion</h3>
            <p className="trigger-panel-desc">
              Fetch latest daily settlement candles for Crypto (BTC, ETH, SOL, XRP) and Spot Metals (Gold, Silver).
            </p>

            <form className="trigger-form" onSubmit={handleTriggerGlobal}>
              <div className="form-fields-wrap">
                <div className="form-group">
                  <label className="form-label">Target Settlement Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={globalDate}
                    onChange={(e) => setGlobalDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Asset Scope</label>
                  <input
                    type="text"
                    className="form-input readonly-input"
                    value="BTC, ETH, SOL, XRP, Gold, Silver"
                    disabled
                  />
                </div>
              </div>

              <button
                type="submit"
                className="trigger-submit-btn btn-global"
                disabled={syncingGlobal || jobs.global?.status === "RUNNING"}
              >
                {syncingGlobal ? "⏳ Ingesting Global Assets..." : "🚀 Run Global EOD Sync"}
              </button>
            </form>
          </div>
        </div>

        {/* 3. Reconciliation Trigger */}
        <div className="trigger-panel">
          <div className="trigger-panel-content">
            <h3 className="trigger-panel-title">🔄 Historical Reconciliation</h3>
            <p className="trigger-panel-desc">
              Re-scan historical candle window to auto-correct corporate actions, stock splits, bonuses, and dividends.
            </p>

            <form className="trigger-form" onSubmit={handleTriggerReconciliation}>
              <div className="form-fields-wrap">
                <div className="form-group">
                  <label className="form-label">Lookback Window (Days)</label>
                  <select
                    className="form-input"
                    value={reconcileDays}
                    onChange={(e) => setReconcileDays(e.target.value)}
                  >
                    <option value={7}>Past 7 Days</option>
                    <option value={15}>Past 15 Days</option>
                    <option value={30}>Past 30 Days (Recommended)</option>
                    <option value={60}>Past 60 Days</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Symbol Limit (Optional test batch)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 10 (leave blank for all)"
                    value={reconcileLimit}
                    onChange={(e) => setReconcileLimit(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="trigger-submit-btn btn-reconcile"
                disabled={syncingReconcile || jobs.reconcile?.status === "RUNNING"}
              >
                {syncingReconcile ? "⏳ Reconciling Data..." : "🚀 Run Reconciliation"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* User-Friendly Execution Results Box */}
      {lastSyncResult && (
        <div className="result-card-wrap">
          <div className="result-card-header">
            <div className="result-card-title-group">
              <span className="result-badge-success">✓ COMPLETED</span>
              <div>
                <div className="result-title">{lastSyncResult.type}</div>
                <div className="result-time">Finished at {lastSyncResult.timestamp}</div>
              </div>
            </div>
            <button
              className="result-btn-dismiss"
              onClick={() => setLastSyncResult(null)}
            >
              Clear Result
            </button>
          </div>

          <div className="result-metrics-grid">
            <div className="result-metric-card success">
              <span className="res-metric-label">Successfully Synced</span>
              <span className="res-metric-val">
                {lastSyncResult.data?.syncedCount ?? lastSyncResult.data?.recordsInserted ?? lastSyncResult.data?.reconciledCount ?? 0}
              </span>
            </div>

            <div className="result-metric-card">
              <span className="res-metric-label">Total Target Symbols</span>
              <span className="res-metric-val">{lastSyncResult.data?.totalSymbols ?? "—"}</span>
            </div>

            {lastSyncResult.data?.skippedCount !== undefined && (
              <div className="result-metric-card skipped">
                <span className="res-metric-label">Skipped (No Trades)</span>
                <span className="res-metric-val">{lastSyncResult.data.skippedCount}</span>
              </div>
            )}

            {lastSyncResult.data?.failedCount !== undefined && (
              <div className={`result-metric-card ${lastSyncResult.data.failedCount > 0 ? "failed" : ""}`}>
                <span className="res-metric-label">Failed (Delisted)</span>
                <span className="res-metric-val">{lastSyncResult.data.failedCount}</span>
              </div>
            )}

            <div className="result-metric-card">
              <span className="res-metric-label">Duration</span>
              <span className="res-metric-val">
                {lastSyncResult.data?.durationMs
                  ? `${(lastSyncResult.data.durationMs / 1000).toFixed(1)}s`
                  : "—"}
              </span>
            </div>
          </div>

          {lastSyncResult.data?.failedSymbols && lastSyncResult.data.failedSymbols.length > 0 && (
            <div className="failed-list-section">
              <div className="failed-list-title">
                <span>⚠️</span> Inactive or Delisted Symbols ({lastSyncResult.data.failedSymbols.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="failed-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Status / Error Reason</th>
                      <th>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSyncResult.data.failedSymbols.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.identifier}</strong></td>
                        <td style={{ color: "#b91c1c" }}>{item.error || "Delisted or suspended"}</td>
                        <td>{item.attempts || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
