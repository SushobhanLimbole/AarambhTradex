import React from "react";
import "./Navbar.css";
import logoImg from "../../assets/logo.jpeg";
import { useAuth } from "../../context/AuthContext";

export default function Navbar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "U";

  return (
    <header className="nav-header">
      <div className="nav-left" onClick={() => setActiveTab("reports")}>
        <img src={logoImg} alt="Aarambh TradeX Logo" className="nav-logo" />
        <span className="nav-brand">Aarambh TradeX</span>
      </div>

      <div className="nav-right">
        <button
          className={`nav-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <span>📊</span>
          <span>Reports</span>
        </button>

        {user?.isAdmin && (
          <button
            className={`nav-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            <span>📋</span>
            <span>Requests</span>
          </button>
        )}

        <button
          className={`profile-avatar-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
          title="Profile & Access Settings"
        >
          <div className="avatar-circle">{initials}</div>
          <span className="profile-btn-label">{user?.name || "Profile"}</span>
        </button>
      </div>
    </header>
  );
}
