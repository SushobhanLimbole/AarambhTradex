import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import StockAnalytics from "./StockAnalytics";
import PointerPage from "../Pointer/PointerPage";
import StrategyPage from "../Strategy/StrategyPage";
import ScreenerPage from "../Screener/ScreenerPage";
import ProfilePage from "../Profile/ProfilePage";
import StrategyAccessRequestsPage from "../Admin/StrategyAccessRequestsPage";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("reports"); // 'reports' | 'pointer' | 'strategy' | 'screener' | 'requests' | 'profile'
  const [pointerData, setPointerData] = useState(null);

  const handleOpenPointer = (row) => {
    if (row) {
      // Parse formatted numbers like "3,025.00" to float
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      setPointerData({
        open: parseVal(row.open) || 962.0,
        high: parseVal(row.high) || 1163.0,
        low: parseVal(row.low) || 962.0,
        close: parseVal(row.close) || 1130.6,
        timeframe: "Daily",
        script: row.symbol || row.script || "Selected Stock",
        title: `${row.symbol || row.date || "Selected"} - Pointer Matrix`,
      });
    }
    setActiveTab("pointer");
  };

  const handleOpenStrategy = (row) => {
    if (row) {
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      setPointerData({
        open: parseVal(row.open) || (row.cmp1Close ? row.cmp1Close * 0.99 : 886.75),
        high: parseVal(row.high) || (row.cmp1Close ? row.cmp1Close * 1.01 : 892.20),
        low: parseVal(row.low) || (row.cmp1Close ? row.cmp1Close * 0.98 : 882.60),
        close: parseVal(row.close) || parseVal(row.cmp1Close) || 890.80,
        range: parseVal(row.range) || undefined,
        average: parseVal(row.average) || undefined,
        timeframe: row.timeframe || "Daily",
        script: row.symbol || row.script || "Selected Stock",
        title: `${row.symbol || row.script || "Selected"} - Strategy Decision Matrix`,
      });
    }
    setActiveTab("strategy");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ paddingBottom: "40px" }}>
        {activeTab === "reports" && <StockAnalytics onOpenPointer={handleOpenPointer} />}
        {activeTab === "pointer" && <PointerPage initialData={pointerData} />}
        {activeTab === "strategy" && <StrategyPage initialData={pointerData} />}
        {activeTab === "screener" && <ScreenerPage onOpenStrategy={handleOpenStrategy} onOpenPointer={handleOpenStrategy} />}
        {activeTab === "requests" && <StrategyAccessRequestsPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>
    </div>
  );
}
