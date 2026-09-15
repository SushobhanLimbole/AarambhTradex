import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import StockAnalytics from "./StockAnalytics";
import PointerPage from "../Pointer/PointerPage";
import StrategyPage from "../Strategy/StrategyPage";
import ProfilePage from "../Profile/ProfilePage";
import StrategyAccessRequestsPage from "../Admin/StrategyAccessRequestsPage";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("reports"); // 'reports' | 'pointer' | 'strategy' | 'requests' | 'profile'
  const [pointerData, setPointerData] = useState(null);

  const handleOpenPointer = (row) => {
    if (row) {
      // Parse formatted numbers like "3,025.00" to float
      const parseVal = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, "")) || 0;
      };
      setPointerData({
        open: parseVal(row.open),
        high: parseVal(row.high),
        low: parseVal(row.low),
        close: parseVal(row.close),
        timeframe: "Daily",
        title: `${row.date || "Selected"} - Pointer Matrix`,
      });
    }
    setActiveTab("pointer");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ paddingBottom: "40px" }}>
        {activeTab === "reports" && <StockAnalytics onOpenPointer={handleOpenPointer} />}
        {activeTab === "pointer" && <PointerPage initialData={pointerData} />}
        {activeTab === "strategy" && <StrategyPage initialData={pointerData} />}
        {activeTab === "requests" && <StrategyAccessRequestsPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>
    </div>
  );
}
