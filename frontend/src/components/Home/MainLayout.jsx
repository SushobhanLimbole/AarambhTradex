import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import StockAnalytics from "./StockAnalytics";
import ProfilePage from "../Profile/ProfilePage";
import StrategyAccessRequestsPage from "../Admin/StrategyAccessRequestsPage";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("reports"); // 'reports' | 'requests' | 'profile'

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ paddingBottom: "40px" }}>
        {activeTab === "reports" && <StockAnalytics />}
        {activeTab === "requests" && <StrategyAccessRequestsPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>
    </div>
  );
}
