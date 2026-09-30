import React, { useState } from "react";
import "./ReportHubPage.css";

// 8 Cards with exact names from the specification image
export const REPORT_CARDS = [
  {
    id: "pointer_breakout_report_1",
    title: "POINTER BREAKOUT REPORT",
    tagline: "Fibonacci Breakout & Directional Momentum",
    tag: "Institutional Signals",
    badge: "Breakouts",
    icon: "⚡",
    color: "#2563eb",
    bgColor: "rgba(37, 99, 235, 0.08)",
    borderColor: "rgba(37, 99, 235, 0.22)",
    description: "Multi-level Fibonacci institutional pointer breakout triggers, rotational momentum detection, and volume breakout targets.",
    metrics: ["Table Tennis", "Table Top", "Upward Rotation", "Rising Jack", "Falling Duck"],
  },
  {
    id: "status_report",
    title: "STATUS REPORT",
    tagline: "4-Point HLC Structural Candle Analysis",
    tag: "Core Structure",
    badge: "HLC Matrix",
    icon: "📊",
    color: "#059669",
    bgColor: "rgba(5, 150, 105, 0.08)",
    borderColor: "rgba(5, 150, 105, 0.22)",
    description: "4-point institutional HLC higher / lower criteria, Virgin day-average thresholds, Zone momentum, and Closure states.",
    metrics: ["HLC HIGHER", "HLC LOWER", "VIRGIN HIGHER", "ZONE GREEN", "CLOSURE HIGH"],
  },
  {
    id: "ab_top_blw_bottom",
    title: "TOP AND BOTTOM EXTREME ZONE",
    tagline: "Above Top & Below Bottom Extreme Pivots",
    tag: "Range Boundaries",
    badge: "Extreme Pivots",
    icon: "🏔️",
    color: "#d97706",
    bgColor: "rgba(217, 119, 6, 0.08)",
    borderColor: "rgba(217, 119, 6, 0.22)",
    description: "Above Top (AT) and Below Bottom (BB) boundary breakout tracking with volatility extremes and channel expansions.",
    metrics: ["Above Top (AT)", "Below Bottom (BB)", "Range High Pivot", "Range Low Pivot"],
  },
  {
    id: "trend_reversal_bullish_bearish",
    title: "MOMENTUM SHIFT REPORT",
    tagline: "Bullish & Bearish Inflection Point Detection",
    tag: "Pivot Reversals",
    badge: "Reversals",
    icon: "🔄",
    color: "#7c3aed",
    bgColor: "rgba(124, 58, 237, 0.08)",
    borderColor: "rgba(124, 58, 237, 0.22)",
    description: "Mathematical reversal matrix identifying bullish exhaustion pivots and high-probability bearish turning point zones.",
    metrics: ["Bullish Reversal", "Bearish Reversal", "Trend Exhaustion", "Pivot Shift"],
  },
  {
    id: "cb",
    title: "COMPARATIVE STUDY",
    tagline: "Closing Candle Breakout & Liquidity Expansion",
    tag: "Price Action",
    badge: "Candle Breakout",
    icon: "🕯️",
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.08)",
    borderColor: "rgba(220, 38, 38, 0.22)",
    description: "Closing Bar Breakout analytics identifying price expansion beyond preceding candle highs, lows, and volatility ranges.",
    metrics: ["Close > Prev High", "Close < Prev Low", "Volumetric Expansion", "Bar Range"],
  },
  {
    id: "highest_closing",
    title: "highest closing",
    tagline: "All-Time & Period Peak Close Benchmarks",
    tag: "Ceiling Resistance",
    badge: "Peak Valuation",
    icon: "👑",
    color: "#0d9488",
    bgColor: "rgba(13, 148, 136, 0.08)",
    borderColor: "rgba(13, 148, 136, 0.22)",
    description: "Historical high watermarks tracking peak closing levels, resistance ceilings, and structural breakout milestones.",
    metrics: ["Period ATH Close", "Rolling Peak Close", "Ceiling Level", "Close Delta %"],
  },
  {
    id: "dd",
    title: "Twin Tower Report",
    tagline: "Daily Directional Bias & Drawdown Distribution",
    tag: "Risk & Direction",
    badge: "Drawdown Risk",
    icon: "📉",
    color: "#e11d48",
    bgColor: "rgba(225, 29, 72, 0.08)",
    borderColor: "rgba(225, 29, 72, 0.22)",
    description: "Daily Direction (DD) bias tracking with peak-to-trough drawdown distributions and recovery ratio factors.",
    metrics: ["Directional Net Delta", "Max Drawdown %", "Recovery Ratio", "Volatility Drop"],
  },
];

export default function ReportHubPage({ onSelectReportCard }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCards = REPORT_CARDS.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tag.toLowerCase().includes(q)
    );
  });

  return (
    <div className="reporthub-container">
      {/* HERO HEADER */}
      <div className="reporthub-header">
        <div className="reporthub-header-left">
          <div className="reporthub-badge">
            <span className="reporthub-dot"></span>
            <span>AARAMBH TRADEX • 8 REPORT SUITE</span>
          </div>
          <h1 className="reporthub-title">Institutional Report Cards</h1>
          <p className="reporthub-subtitle">
            Explore the 8 specialized research report modules engineered for mathematical breakouts, HLC status, extreme pivots, and formula models.
          </p>
        </div>

        <div className="reporthub-header-right">
          <div className="reporthub-search">
            <input
              type="text"
              placeholder="Search 8 report cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="reporthub-search-input"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FEATURED NEW TREND SCANNER BANNER */}
      {/* <div className="featured-trend-banner" onClick={() => onSelectReportCard && onSelectReportCard({ id: "status_report" })}>
        <div className="ftb-left">
          <span className="ftb-badge">LIVE SCANNER</span>
          <h2 className="ftb-title">📈 NEW TREND REPORT (Trend Scanner)</h2>
          <p className="ftb-desc">HLC Higher / Lower multi-timeframe trend direction scanner with Area, Slot, Power, HTR-LTR, and HTF trend matrices.</p>
        </div>
        <button type="button" className="ftb-btn">
          Open Live Trend Scanner ➔
        </button>
      </div> */}

      {/* 8 CARDS GRID */}
      <div className="reporthub-grid">
        {filteredCards.map((card, index) => {
          const isSelected = selectedCard?.id === card.id;

          return (
            <div
              key={card.id}
              className={`reporthub-card ${isSelected ? "active" : ""}`}
              onClick={() => {
                setSelectedCard(card);
                if (onSelectReportCard) onSelectReportCard(card);
              }}
              style={{
                "--accent-color": card.color,
                "--accent-bg": card.bgColor,
                "--accent-border": card.borderColor,
              }}
            >
              {/* Card Header */}
              <div className="card-top-row">
                <div className="card-icon-bubble" style={{ background: card.bgColor, color: card.color }}>
                  <span>{card.icon}</span>
                </div>
                <div className="card-pill-stack">
                  <span className="card-seq-no">0{index + 1}</span>
                  <span className="card-badge-pill">{card.badge}</span>
                </div>
              </div>

              {/* Card Content */}
              <div className="card-content-area">
                <h2 className="card-main-title">{card.title}</h2>
                <h4 className="card-tagline">{card.tagline}</h4>
                <p className="card-desc-text">{card.description}</p>
              </div>

              {/* Metrics Pill Grid */}
              <div className="card-metrics-grid">
                {card.metrics.map((m, mIdx) => (
                  <span key={mIdx} className="card-metric-chip">
                    {m}
                  </span>
                ))}
              </div>

              {/* Card Footer */}
              <div className="card-bottom-row">
                <span className="card-category-tag" style={{ color: card.color, borderColor: card.borderColor }}>
                  {card.tag}
                </span>
                <button
                  type="button"
                  className={`card-action-btn ${isSelected ? "selected-btn" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard(card);
                    if (onSelectReportCard) onSelectReportCard(card);
                  }}
                >
                  {isSelected ? "Selected ✓" : "Open Card ➔"}
                </button>
              </div>

              {isSelected && <div className="card-selection-glow"></div>}
            </div>
          );
        })}
      </div>

      {/* SELECTED CARD DETAIL MODAL / DRAWER IF SELECTED */}
      {selectedCard && (
        <div className="reporthub-modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="reporthub-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="reporthub-modal-header" style={{ borderLeft: `5px solid ${selectedCard.color}` }}>
              <div className="modal-title-group">
                <div className="modal-icon-bubble" style={{ background: selectedCard.bgColor, color: selectedCard.color }}>
                  {selectedCard.icon}
                </div>
                <div>
                  <div className="modal-kicker">{selectedCard.badge} • REPORT CARD</div>
                  <h2 className="modal-heading">{selectedCard.title}</h2>
                  <p className="modal-subheading">{selectedCard.tagline}</p>
                </div>
              </div>
              <button className="modal-close-button" onClick={() => setSelectedCard(null)}>
                ✕
              </button>
            </div>

            <div className="reporthub-modal-body">
              <div className="modal-overview-section">
                <h3>Executive Summary</h3>
                <p>{selectedCard.description}</p>
              </div>

              <div className="modal-metrics-section">
                <h3>Key Institutional Indicators</h3>
                <div className="modal-chips-wrap">
                  {selectedCard.metrics.map((m, i) => (
                    <div key={i} className="modal-indicator-card">
                      <span className="indicator-dot" style={{ background: selectedCard.color }}></span>
                      <span className="indicator-name">{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-notice-box">
                <span className="notice-icon">💡</span>
                <span>
                  This report card represents the official <strong>{selectedCard.title}</strong> analytical framework engineered for professional trading and mathematical decision execution.
                </span>
              </div>
            </div>

            <div className="reporthub-modal-footer">
              <button type="button" className="modal-btn-close" onClick={() => setSelectedCard(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
