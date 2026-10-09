import React, { useState, useEffect } from "react";
import Navbar from "../Navbar/Navbar";
import SymbolsPage from "../Symbols/SymbolsPage";
import StockAnalytics from "./StockAnalytics";
import ReportHubPage from "../Reports/ReportHubPage";
import NewTrendReportPage from "../NewTrendReport";
import AbTopBottomPage from "../AbTopBottom";
import TrendReversalPage from "../TrendReversal";
import CbReportPage from "../CbReport";
import HighestClosingPage from "../HighestClosing";
import DdReportPage from "../DdReport";
import PointerReportPage from "../PointerReport";
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
  const isAdmin = Boolean(user?.isAdmin);
  const canAccessReports = Boolean(user?.isAdmin || user?.hasAccess);

  // Parse URL search parameters on initial mount to support new tab deep links
  const initialUrlState = React.useMemo(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const symbol = urlParams.get("symbol");
      const tabParam = urlParams.get("tab") || window.location.hash.replace("#", "");

      if (symbol) {
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const formatDate = (d) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        const fromDate = urlParams.get("fromDate") || formatDate(sixMonthsAgo);
        const toDate = urlParams.get("toDate") || formatDate(now);
        const exchange = urlParams.get("exchange") || "ALL";
        const indice = urlParams.get("indice") || "ALL";
        const timeframe = urlParams.get("timeframe") || "Daily";
        const highlightDate = urlParams.get("highlightDate") || urlParams.get("date") || "";

        return {
          tab: "reports",
          stockParams: {
            symbol,
            exchange,
            indice,
            fromDate,
            toDate,
            timeframe,
            highlightDate,
          },
        };
      }

      if (tabParam && tabParam !== "profile" && tabParam !== "reports") {
        return { tab: tabParam, stockParams: null };
      }
    } catch (_) {}
    return { tab: "symbols", stockParams: null };
  }, []);

  const [activeTab, setActiveTab] = useState(initialUrlState.tab || "symbols");
  const [tabHistory, setTabHistory] = useState([initialUrlState.tab || "symbols"]);
  const [pointerData, setPointerData] = useState(null);
  const [selectedStockParams, setSelectedStockParams] = useState(initialUrlState.stockParams || null);
  const [screenerCache, setScreenerCache] = useState(null);

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

  const REPORT_TABS = [
    "reporthub",
    "pointer-report",
    "trend-report",
    "ab-top-bottom",
    "trend-reversal",
    "cb-report",
    "highest-closing",
    "dd-report",
    "screener",
  ];

  // Restrict Report Hub and all reports to users with strategy/report access
  // Restrict Strategy page to admin only (redirect regular users to pointer)
  useEffect(() => {
    if (!canAccessReports && REPORT_TABS.includes(activeTab)) {
      setActiveTab("symbols");
      setTabHistory(["symbols"]);
      try {
        window.history.replaceState({ tab: "symbols" }, "", "#symbols");
      } catch (_) {}
    } else if (!isAdmin && activeTab === "strategy") {
      setActiveTab("pointer");
      setTabHistory((prev) => [...prev.filter((t) => t !== "strategy"), "pointer"]);
      try {
        window.history.replaceState({ tab: "pointer" }, "", "#pointer");
      } catch (_) {}
    }
  }, [canAccessReports, isAdmin, activeTab]);

  const handleTabChange = (newTab) => {
    if (!canAccessReports && REPORT_TABS.includes(newTab)) {
      return;
    }
    // Only admin can switch to strategy tab; non-admins get pointer tab
    let resolvedTab = newTab;
    if (resolvedTab === "strategy" && !isAdmin) {
      resolvedTab = "pointer";
    }

    if (resolvedTab === "pointer" || resolvedTab === "strategy") {
      setPointerData(null);
    }
    if (resolvedTab !== activeTab) {
      setTabHistory((prev) => [...prev, resolvedTab]);
      setActiveTab(resolvedTab);
      try {
        window.history.pushState({ tab: resolvedTab }, "", `#${resolvedTab}`);
      } catch (_) {}
    }
  };

  const handleSelectSymbolFromDirectory = (symbolItem) => {
    if (!symbolItem?.symbol) return;
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const params = {
      symbol: symbolItem.symbol,
      exchange: symbolItem.exchange || "ALL",
      indice: symbolItem.indice || "ALL",
      fromDate: formatDate(sixMonthsAgo),
      toDate: formatDate(now),
      timeframe: "Daily",
    };

    setSelectedStockParams(params);
    setTabHistory((prev) => [...prev, "reports"]);
    setActiveTab("reports");
    try {
      window.history.pushState({ tab: "reports" }, "", "#reports");
    } catch (_) {}
  };

  const handleOpenPointerOrStrategy = (row, fromTab = activeTab) => {
    const targetTab = isAdmin ? "strategy" : "pointer";
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
        isReadOnly: true,
        showTabSelector: false,
        fromTab,
        title: isAdmin
          ? `${cleanScript} - Strategy Decision Matrix`
          : `${cleanScript} - Pointer Matrix`,
      });
    } else {
      setPointerData(null);
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
      const previous = nextHistory[nextHistory.length - 1] || "symbols";
      setTabHistory(nextHistory);
      setActiveTab(previous);
      try {
        window.history.pushState({ tab: previous }, "", `#${previous}`);
      } catch (_) {}
    } else {
      setActiveTab("symbols");
    }
  };

  const handleSelectSymbolFromScreener = (stockParams) => {
    if (!stockParams?.symbol) return;
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    setSelectedStockParams({
      symbol: stockParams.symbol,
      exchange: stockParams.exchange || "ALL",
      indice: stockParams.indice || "ALL",
      fromDate: formatDate(sixMonthsAgo),
      toDate: formatDate(now),
      timeframe: stockParams.timeframe || "Daily",
    });
    setTabHistory((prev) => [...prev, "reports"]);
    setActiveTab("reports");
    try {
      window.history.pushState({ tab: "reports" }, "", "#reports");
    } catch (_) {}
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
        {activeTab === "symbols" && (
          <SymbolsPage onSelectSymbol={handleSelectSymbolFromDirectory} />
        )}
        {activeTab === "reports" && (
          <StockAnalytics
            selectedStockParams={selectedStockParams}
            onBackToSymbols={() => handleTabChange("symbols")}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "reports")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "reports")}
          />
        )}
        {activeTab === "trend-report" && (
          <NewTrendReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "trend-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "trend-report")}
            onOpenStockAnalytics={handleSelectSymbolFromScreener}
          />
        )}
        {activeTab === "ab-top-bottom" && (
          <AbTopBottomPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "ab-top-bottom")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "ab-top-bottom")}
            onOpenStockAnalytics={handleSelectSymbolFromScreener}
          />
        )}
        {activeTab === "trend-reversal" && (
          <TrendReversalPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "trend-reversal")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "trend-reversal")}
            onOpenStockAnalytics={handleSelectSymbolFromScreener}
          />
        )}
        {activeTab === "cb-report" && (
          <CbReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "cb-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "cb-report")}
            onOpenStockAnalytics={handleSelectSymbolFromScreener}
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
        {activeTab === "pointer-report" && (
          <PointerReportPage
            onBack={handleBack}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "pointer-report")}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "pointer-report")}
          />
        )}
        {activeTab === "reporthub" && (
          <ReportHubPage
            onSelectReportCard={(card) => {
              if (!card) return;
              switch (card.id) {
                case "pointer_breakout_report_1":
                  handleTabChange("screener");
                  break;
                case "pointer_report":
                  handleTabChange("pointer-report");
                  break;
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
                default:
                  break;
              }
            }}
          />
        )}
        {activeTab === "pointer" && (
          <PointerPage
            initialData={pointerData}
            readOnly={Boolean(pointerData?.isReadOnly)}
            showTabSelector={!pointerData?.isReadOnly}
            previousTab={pointerData?.fromTab || "reports"}
            onBack={handleBack}
          />
        )}
        {activeTab === "strategy" && (
          isAdmin ? (
            <StrategyPage
              initialData={pointerData}
              readOnly={Boolean(pointerData?.isReadOnly)}
              showTabSelector={!pointerData?.isReadOnly}
              previousTab={pointerData?.fromTab || "reports"}
              onBack={handleBack}
            />
          ) : (
            <PointerPage
              initialData={pointerData}
              readOnly={Boolean(pointerData?.isReadOnly)}
              showTabSelector={!pointerData?.isReadOnly}
              previousTab={pointerData?.fromTab || "reports"}
              onBack={handleBack}
            />
          )
        )}
        {activeTab === "screener" && (
          <ScreenerPage
            onBack={handleBack}
            savedState={screenerCache}
            onSaveState={setScreenerCache}
            onOpenStrategy={(row) => handleOpenPointerOrStrategy(row, "screener")}
            onOpenPointer={(row) => handleOpenPointerOrStrategy(row, "screener")}
            onOpenStockAnalytics={handleSelectSymbolFromScreener}
          />
        )}
        {activeTab === "requests" && <StrategyAccessRequestsPage onBack={handleBack} />}
        {activeTab === "datasync" && <DataSyncPage onBack={handleBack} />}
        {activeTab === "profile" && <ProfilePage onBack={handleBack} />}
      </main>
    </div>
  );
}
