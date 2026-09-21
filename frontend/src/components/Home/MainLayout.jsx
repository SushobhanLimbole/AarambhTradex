import React, { useState, useEffect } from "react";
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
import DataSyncPage from "../Admin/DataSyncPage";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function MainLayout() {
  const { user } = useAuth();
  const canAccessStrategy = Boolean(user?.isAdmin || user?.hasAccess);

  const [activeTab, setActiveTab] = useState("reports");
  const [tabHistory, setTabHistory] = useState(["reports"]);
  const [pointerData, setPointerData] = useState(null);

  // Browser back/forward button synchronization
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.tab) {
        setActiveTab(e.state.tab);
        setTabHistory((prev) => {
          if (prev.length > 1 && prev[prev.length - 2] === e.state.tab) {
            return prev.slice(0, -1);
          }
          return [...prev, e.state.tab];
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      setTabHistory((prev) => [...prev, newTab]);
      setActiveTab(newTab);
      try {
        window.history.pushState({ tab: newTab }, "", `#${newTab}`);
      } catch (_) {}
    }
  };

  const handleOpenPointerOrStrategy = (row, fromTab = activeTab) => {
    const targetTab = canAccessStrategy ? "strategy" : "pointer";
    setTabHistory((prev) => [...prev, targetTab]);

    if (row) {
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      const cleanScript = stripSymbolSuffix(row.symbol || row.script || "Selected Stock");
      setPointerData({
        open: parseVal(row.open) || (row.cmp1Close ? row.cmp1Close * 0.99 : 962.0),
        high: parseVal(row.high) || (row.cmp1Close ? row.cmp1Close * 1.01 : 1163.0),
        low: parseVal(row.low) || (row.cmp1Close ? row.cmp1Close * 0.98 : 962.0),
        close: parseVal(row.close) || parseVal(row.cmp1Close) || 1130.6,
        range: parseVal(row.range) || undefined,
        average: parseVal(row.average) || undefined,
        timeframe: row.timeframe || "Daily",
        symbol: row.symbol,
        script: cleanScript,
        title: canAccessStrategy
          ? `${cleanScript} - Strategy Decision Matrix`
          : `${cleanScript} - Pointer Matrix`,
      });
    }

    setActiveTab(targetTab);
    try {
      window.history.pushState({ tab: targetTab }, "", `#${targetTab}`);
    } catch (_) {}
  };

  const handleBack = () => {
    if (tabHistory.length > 1) {
      const nextHistory = [...tabHistory];
      nextHistory.pop(); // Remove current tab
      const previous = nextHistory[nextHistory.length - 1] || "reports";
      setTabHistory(nextHistory);
      setActiveTab(previous);
      try {
        window.history.pushState({ tab: previous }, "", `#${previous}`);
      } catch (_) {}
    } else {
      setActiveTab("reports");
    }
  };

  const isReportsTab = activeTab === "reports";

  return (
    <div
      style={{
        height: isReportsTab ? "100vh" : "auto",
        minHeight: "100vh",
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        overflow: isReportsTab ? "hidden" : "visible",
      }}
    >
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          paddingBottom: isReportsTab ? "12px" : "32px",
          overflow: isReportsTab ? "hidden" : "visible",
        }}
      >
        {activeTab === "reports" && (
          <StockAnalytics
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "reports")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "reports")}
          />
        )}
        {activeTab === "trend-report" && (
          <NewTrendReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "trend-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "trend-report")}
          />
        )}
        {activeTab === "ab-top-bottom" && (
          <AbTopBottomPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "ab-top-bottom")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "ab-top-bottom")}
          />
        )}
        {activeTab === "trend-reversal" && (
          <TrendReversalPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "trend-reversal")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "trend-reversal")}
          />
        )}
        {activeTab === "cb-report" && (
          <CbReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "cb-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "cb-report")}
          />
        )}
        {activeTab === "highest-closing" && (
          <HighestClosingPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "highest-closing")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "highest-closing")}
          />
        )}
        {activeTab === "dd-report" && (
          <DdReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "dd-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "dd-report")}
          />
        )}
        {activeTab === "reporthub" && (
          <ReportHubPage
            onSelectReportCard={(card) => {
              if (!card) return;
              switch (card.id) {
                case "status_report":
                case "new_trend_report":
                  handleTabChange("trend-report");
                  break;
                case "ab_top_blw_bottom":
                  handleTabChange("ab-top-bottom");
                  break;
                case "trend_reversal_bullish_bearish":
                  handleTabChange("trend-reversal");
                  break;
                case "cb":
                  handleTabChange("cb-report");
                  break;
                case "highest_closing":
                  handleTabChange("highest-closing");
                  break;
                case "dd":
                  handleTabChange("dd-report");
                  break;
                case "pointer_breakout_report_1":
                  handleTabChange("screener");
                  break;
                default:
                  break;
              }
            }}
          />
        )}
        {activeTab === "pointer" && (
          <PointerPage
            initialData={pointerData}
            onBack={handleBack}
          />
        )}
        {activeTab === "strategy" && (
          canAccessStrategy ? (
            <StrategyPage
              initialData={pointerData}
              onBack={handleBack}
            />
          ) : (
            <PointerPage
              initialData={pointerData}
              onBack={handleBack}
            />
          )
        )}
        {activeTab === "screener" && (
          <ScreenerPage
            onBack={handleBack}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "screener")}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "screener")}
          />
        )}
        {activeTab === "requests" && <StrategyAccessRequestsPage onBack={handleBack} />}
        {activeTab === "datasync" && <DataSyncPage onBack={handleBack} />}
        {activeTab === "profile" && <ProfilePage onBack={handleBack} />}
      </main>
    </div>
  );
}
