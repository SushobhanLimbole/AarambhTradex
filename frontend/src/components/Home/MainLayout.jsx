import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import StockAnalytics from "./StockAnalytics";
import ReportHubPage from "../Reports/ReportHubPage";
import NewTrendReportPage from "../NewTrendReport";
import AbTopBottomPage from "../AbTopBottom";
import TrendReversalPage from "../TrendReversal";
import CbReportPage from "../CbReport";
import HighestClosingPage from "../HighestClosing";
import DdReportPage from "../DdReport";
import PointerPage from "../Pointer/PointerPage";
import StrategyPage from "../Strategy/StrategyPage";
import ScreenerPage from "../Screener/ScreenerPage";
import ProfilePage from "../Profile/ProfilePage";
import StrategyAccessRequestsPage from "../Admin/StrategyAccessRequestsPage";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("reports"); // 'reports' | 'trend-report' | 'ab-top-bottom' | 'trend-reversal' | 'cb-report' | 'reporthub' | 'pointer' | 'strategy' | 'screener' | 'requests' | 'profile'
  const [previousTab, setPreviousTab] = useState("screener");
  const [pointerData, setPointerData] = useState(null);

  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(newTab);
    }
  };

  const handleOpenPointer = (row, fromTab = "screener") => {
    setPreviousTab(fromTab || activeTab || "screener");
    if (row) {
      // Parse formatted numbers like "3,025.00" to float
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      const cleanScript = stripSymbolSuffix(row.symbol || row.script || "Selected Stock");
      setPointerData({
        open: parseVal(row.open) || 962.0,
        high: parseVal(row.high) || 1163.0,
        low: parseVal(row.low) || 962.0,
        close: parseVal(row.close) || 1130.6,
        timeframe: "Daily",
        symbol: row.symbol,
        script: cleanScript,
        title: `${cleanScript} - Pointer Matrix`,
      });
    }
    setActiveTab("pointer");
  };

  const handleOpenStrategy = (row, fromTab = "screener") => {
    setPreviousTab(fromTab || activeTab || "screener");
    if (row) {
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      const cleanScript = stripSymbolSuffix(row.symbol || row.script || "Selected Stock");
      setPointerData({
        open: parseVal(row.open) || (row.cmp1Close ? row.cmp1Close * 0.99 : 886.75),
        high: parseVal(row.high) || (row.cmp1Close ? row.cmp1Close * 1.01 : 892.20),
        low: parseVal(row.low) || (row.cmp1Close ? row.cmp1Close * 0.98 : 882.60),
        close: parseVal(row.close) || parseVal(row.cmp1Close) || 890.80,
        range: parseVal(row.range) || undefined,
        average: parseVal(row.average) || undefined,
        timeframe: row.timeframe || "Daily",
        symbol: row.symbol,
        script: cleanScript,
        title: `${cleanScript} - Strategy Decision Matrix`,
      });
    }
    setActiveTab("strategy");
  };

  const handleBack = () => {
    setActiveTab(previousTab || "screener");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: "32px" }}>
        <div style={{ display: activeTab === "reports" ? "block" : "none" }}>
          <StockAnalytics
            onOpenPointer={(row) => handleOpenPointer(row, "reports")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "reports")}
          />
        </div>
        <div style={{ display: activeTab === "trend-report" ? "block" : "none" }}>
          <NewTrendReportPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "trend-report")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "trend-report")}
          />
        </div>
        <div style={{ display: activeTab === "ab-top-bottom" ? "block" : "none" }}>
          <AbTopBottomPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "ab-top-bottom")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "ab-top-bottom")}
          />
        </div>
        <div style={{ display: activeTab === "trend-reversal" ? "block" : "none" }}>
          <TrendReversalPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "trend-reversal")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "trend-reversal")}
          />
        </div>
        <div style={{ display: activeTab === "cb-report" ? "block" : "none" }}>
          <CbReportPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "cb-report")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "cb-report")}
          />
        </div>
        <div style={{ display: activeTab === "highest-closing" ? "block" : "none" }}>
          <HighestClosingPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "highest-closing")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "highest-closing")}
          />
        </div>
        <div style={{ display: activeTab === "dd-report" ? "block" : "none" }}>
          <DdReportPage
            onBack={() => setActiveTab("reporthub")}
            onOpenPointer={(row) => handleOpenPointer(row, "dd-report")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "dd-report")}
          />
        </div>
        <div style={{ display: activeTab === "reporthub" ? "block" : "none" }}>
          <ReportHubPage
            onSelectReportCard={(card) => {
              if (!card) return;
              switch (card.id) {
                // 1. STATUS REPORT & NEW TREND SCANNER -> Trend Scanner Report
                case "status_report":
                case "new_trend_report":
                  setActiveTab("trend-report");
                  break;

                // 2. AB TOP BLW BOTTOM -> Above Top & Below Bottom Report
                case "ab_top_blw_bottom":
                  setActiveTab("ab-top-bottom");
                  break;

                // 3. TREND REVERSAL BULLISH-BEARISH -> Trend Reversal Report
                case "trend_reversal_bullish_bearish":
                  setActiveTab("trend-reversal");
                  break;

                // 4. CB (ORDINARY CB & CB WITH STATUS) -> CB Report
                case "cb":
                  setActiveTab("cb-report");
                  break;

                // 5. HIGHEST CLOSING (TYPE 1 & TYPE 2) -> Highest Closing Report
                case "highest_closing":
                  setActiveTab("highest-closing");
                  break;

                // 6. BULLISH DD - BEARISH DD -> DD Report
                case "dd":
                  setActiveTab("dd-report");
                  break;

                // 7. POINTER BREAKOUT REPORT_1 -> Screener
                case "pointer_breakout_report_1":
                  setActiveTab("screener");
                  break;

                /* -------------------------------------------------------------
                   ROUTES FOR REMAINING REPORT CARDS (NOT YET CREATED)
                   Left commented as requested:
                   ------------------------------------------------------------- */
                // case "y1_y6_formulas":
                //   setActiveTab("y1-y6-formulas-report");
                //   break;

                default:
                  break;
              }
            }}
          />
        </div>
        <div style={{ display: activeTab === "pointer" ? "block" : "none" }}>
          <PointerPage
            initialData={pointerData}
            onBack={handleBack}
            previousTab={previousTab}
          />
        </div>
        <div style={{ display: activeTab === "strategy" ? "block" : "none" }}>
          <StrategyPage
            initialData={pointerData}
            onBack={handleBack}
            previousTab={previousTab}
          />
        </div>
        <div style={{ display: activeTab === "screener" ? "block" : "none" }}>
          <ScreenerPage
            onBack={() => setActiveTab("reporthub")}
            onOpenStrategy={(row) => handleOpenStrategy(row, "screener")}
            onOpenPointer={(row) => handleOpenStrategy(row, "screener")}
          />
        </div>
        {activeTab === "requests" && <StrategyAccessRequestsPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>
    </div>
  );
}
