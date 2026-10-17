import React, { useState, useEffect, useMemo } from "react";
import "./AdminPage.css";
import logoImg from "../../assets/logo.jpeg";
import { useAuth } from "../../context/AuthContext.jsx";
import authService from "../../services/authService.js";
import strategyAccessService from "../../services/strategyAccessService.js";
import Toast from "../Common/Toast.jsx";
import StrategyAccessRequestsPage from "./StrategyAccessRequestsPage.jsx";
import DataSyncPage from "./DataSyncPage.jsx";

export default function AdminPage({ onBack, defaultTab = "dashboard" }) {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Users data state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'admin' | 'trader' | 'granted'

  // Access requests data state
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Time filter dropdown state for widgets
  const [timeFilter, setTimeFilter] = useState("6 months");

  // Modals state
  const [resetUserModal, setResetUserModal] = useState({
    open: false,
    user: null,
    newPassword: "",
    confirmPassword: "",
    showPassword: false,
    submitting: false,
    error: "",
  });

  const [resetAdminModal, setResetAdminModal] = useState({
    open: false,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    showPassword: false,
    submitting: false,
    error: "",
  });

  const [addUserModal, setAddUserModal] = useState({
    open: false,
    name: "",
    email: "",
    password: "",
    hasAccess: false,
    showPassword: false,
    submitting: false,
    error: "",
  });

  // Fetch users & requests on mount
  useEffect(() => {
    fetchUsers();
    fetchRequests();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await authService.adminGetUsers();
      if (res?.data?.users) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
      setToast({ message: "Failed to load user list from server.", type: "error" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await strategyAccessService.getAllRequests();
      if (res?.data?.requests) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Derived statistics for widgets
  const totalUsersCount = users.length;
  const grantedUsersCount = users.filter((u) => u.hasAccess).length;
  const standardUsersCount = Math.max(0, totalUsersCount - grantedUsersCount);
  const pendingRequestsCount = requests.filter((r) => r.status === "pending").length;

  // Filtered users list with Search Box and Role Filter
  const filteredUsers = useMemo(() => {
    let result = users;

    // Filter by role/access pill
    if (roleFilter === "admin") {
      result = result.filter((u) => u.isAdmin);
    } else if (roleFilter === "trader") {
      result = result.filter((u) => !u.isAdmin);
    } else if (roleFilter === "granted") {
      result = result.filter((u) => u.hasAccess);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((u) => {
        const nameMatch = u.name && u.name.toLowerCase().includes(q);
        const emailMatch = u.email && u.email.toLowerCase().includes(q);
        const roleMatch = (u.isAdmin ? "admin" : "trader").includes(q);
        const statusMatch = (u.hasAccess ? "granted" : "locked").includes(q);
        return nameMatch || emailMatch || roleMatch || statusMatch;
      });
    }

    return result;
  }, [users, roleFilter, searchQuery]);

  // Handle Delete User
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await authService.adminDeleteUser(userId);
      setToast({ message: `User "${userName}" has been deleted.`, type: "success" });
      fetchUsers();
    } catch (err) {
      setToast({ message: err.message || "Failed to delete user.", type: "error" });
    }
  };

  // Handle Reset Other User Password
  const handleOpenResetUser = (targetUser) => {
    setResetUserModal({
      open: true,
      user: targetUser,
      newPassword: "",
      confirmPassword: "",
      showPassword: false,
      submitting: false,
      error: "",
    });
  };

  const handleConfirmResetUser = async (e) => {
    e?.preventDefault();
    const { user: targetUser, newPassword, confirmPassword } = resetUserModal;

    if (!newPassword || newPassword.length < 6) {
      setResetUserModal((prev) => ({ ...prev, error: "Password must be at least 6 characters long." }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetUserModal((prev) => ({ ...prev, error: "Passwords do not match." }));
      return;
    }

    try {
      setResetUserModal((prev) => ({ ...prev, submitting: true, error: "" }));
      await authService.adminResetPassword(targetUser.id || targetUser._id, newPassword);
      setToast({
        message: `Password for "${targetUser.name}" has been successfully reset!`,
        type: "success",
      });
      setResetUserModal({
        open: false,
        user: null,
        newPassword: "",
        confirmPassword: "",
        showPassword: false,
        submitting: false,
        error: "",
      });
    } catch (err) {
      setResetUserModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || "Failed to reset user password.",
      }));
    }
  };

  // Handle Reset Admin Own Password
  const handleOpenResetAdmin = () => {
    setResetAdminModal({
      open: true,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      showPassword: false,
      submitting: false,
      error: "",
    });
  };

  const handleConfirmResetAdmin = async (e) => {
    e?.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = resetAdminModal;

    if (!newPassword || newPassword.length < 6) {
      setResetAdminModal((prev) => ({ ...prev, error: "New password must be at least 6 characters long." }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetAdminModal((prev) => ({ ...prev, error: "Passwords do not match." }));
      return;
    }

    try {
      setResetAdminModal((prev) => ({ ...prev, submitting: true, error: "" }));
      await authService.changePassword(currentPassword, newPassword);
      setToast({
        message: "Your admin password has been updated successfully!",
        type: "success",
      });
      setResetAdminModal({
        open: false,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        showPassword: false,
        submitting: false,
        error: "",
      });
    } catch (err) {
      setResetAdminModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || "Failed to update admin password.",
      }));
    }
  };

  // Handle Add New User
  const handleOpenAddUser = () => {
    setAddUserModal({
      open: true,
      name: "",
      email: "",
      password: "",
      hasAccess: false,
      showPassword: false,
      submitting: false,
      error: "",
    });
  };

  const handleConfirmAddUser = async (e) => {
    e?.preventDefault();
    const { name, email, password, hasAccess } = addUserModal;

    if (!name.trim()) {
      setAddUserModal((prev) => ({ ...prev, error: "Full Name is required." }));
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setAddUserModal((prev) => ({ ...prev, error: "Please enter a valid email address." }));
      return;
    }
    if (!password || password.length < 6) {
      setAddUserModal((prev) => ({ ...prev, error: "Password must be at least 6 characters." }));
      return;
    }

    try {
      setAddUserModal((prev) => ({ ...prev, submitting: true, error: "" }));
      await authService.adminCreateUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        hasAccess,
      });
      setToast({
        message: `User "${name.trim()}" created successfully!`,
        type: "success",
      });
      setAddUserModal({
        open: false,
        name: "",
        email: "",
        password: "",
        hasAccess: false,
        showPassword: false,
        submitting: false,
        error: "",
      });
      fetchUsers();
    } catch (err) {
      setAddUserModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || "Failed to create user.",
      }));
    }
  };

  return (
    <div className="adm-dashboard-container">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />

      {/* LEFT NAVIGATION SIDEBAR (Themed with clean Aarambh TradeX styling) */}
      <aside className="adm-sidebar">
        {/* Top Logo */}
        <div className="adm-sidebar-logo-wrap">
          <div className="adm-sidebar-logo-circle">
            <img src={logoImg} alt="Aarambh TradeX Logo" className="adm-sidebar-logo-img" />
          </div>
          <div className="adm-sidebar-brand-name">Aarambh</div>
        </div>

        {/* Navigation Items */}
        <nav className="adm-nav-list">
          <button
            type="button"
            className={`adm-nav-item ${activeNav === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveNav("dashboard")}
            title="Overview Dashboard"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            <span className="adm-nav-label">Home</span>
          </button>

          <button
            type="button"
            className={`adm-nav-item ${activeNav === "users" ? "active" : ""}`}
            onClick={() => setActiveNav("users")}
            title="User Accounts Management"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </span>
            <span className="adm-nav-label">Users</span>
          </button>

          <button
            type="button"
            className={`adm-nav-item ${activeNav === "requests" ? "active" : ""}`}
            onClick={() => setActiveNav("requests")}
            title="Strategy Access Requests"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </span>
            <span className="adm-nav-label">Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="adm-nav-badge">{pendingRequestsCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`adm-nav-item ${activeNav === "datasync" ? "active" : ""}`}
            onClick={() => setActiveNav("datasync")}
            title="Data Sync Operations"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
              </svg>
            </span>
            <span className="adm-nav-label">Data Sync</span>
          </button>

          <button
            type="button"
            className={`adm-nav-item ${activeNav === "security" ? "active" : ""}`}
            onClick={() => setActiveNav("security")}
            title="Admin & User Password Security"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <span className="adm-nav-label">Security</span>
          </button>
        </nav>

        {/* Bottom Sidebar Items */}
        <div className="adm-sidebar-bottom">
          <button
            type="button"
            className="adm-nav-item"
            onClick={handleOpenResetAdmin}
            title="Reset Admin Password"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span className="adm-nav-label">Settings</span>
          </button>

          <button
            type="button"
            className="adm-nav-item adm-signout-btn"
            onClick={logout}
            title="Sign Out"
          >
            <span className="adm-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </span>
            <span className="adm-nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="adm-main-body">
        {/* TOP BANNER — Matches exact default theme from user screenshot */}
        <div className="adm-header-banner">
          <div className="adm-header-left">
            <div className="adm-header-badge">AARAMBH TRADEX ADMIN CONTROL CENTER</div>
            <h1 className="adm-header-title">Welcome {user?.name || "Admin"}!</h1>
            <p className="adm-header-sub">
              Manage platform trader accounts, reset passwords, and oversee institutional strategy access permissions.
            </p>
          </div>

          <div className="adm-header-right">
            <button
              type="button"
              className="adm-banner-reset-admin-btn"
              onClick={handleOpenResetAdmin}
              title="Change master admin login password"
            >
              <span>🔑</span>
              <span>Reset Admin Password</span>
            </button>
          </div>
        </div>

        {/* 4 STAT CARDS ROW — Styled identically to default screenshot */}
        <div className="adm-stats-row">
          <div className="adm-stat-card">
            <div className="adm-stat-icon blue">📈</div>
            <div className="adm-stat-info">
              <div className="adm-stat-value">{totalUsersCount}</div>
              <div className="adm-stat-label">Total Users</div>
            </div>
          </div>

          <div className="adm-stat-card">
            <div className="adm-stat-icon emerald">🛡️</div>
            <div className="adm-stat-info">
              <div className="adm-stat-value">{grantedUsersCount}</div>
              <div className="adm-stat-label">Strategy Granted</div>
            </div>
          </div>

          <div className="adm-stat-card">
            <div className="adm-stat-icon indigo">👥</div>
            <div className="adm-stat-info">
              <div className="adm-stat-value">{standardUsersCount}</div>
              <div className="adm-stat-label">Standard Traders</div>
            </div>
          </div>

          <div className="adm-stat-card">
            <div className="adm-stat-icon amber">⏳</div>
            <div className="adm-stat-info">
              <div className="adm-stat-value">{pendingRequestsCount}</div>
              <div className="adm-stat-label">Pending Requests</div>
            </div>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD OVERVIEW */}
        {activeNav === "dashboard" && (
          <div className="adm-dashboard-grid-wrap">
            {/* TOP ROW OF CARDS */}
            <div className="adm-grid-top-row">
              {/* CARD 1: LARGE WAVE CHART CARD */}
              <div className="adm-card adm-card-large-chart">
                <div className="adm-chart-header">
                  <div>
                    <div className="adm-metric-large">
                      {totalUsersCount} <span className="adm-metric-unit">Accounts</span>
                    </div>
                    <div className="adm-metric-sublabel">Platform Accounts Growth &amp; Permissions</div>
                  </div>

                  <div className="adm-chart-legend-wrap">
                    <div className="adm-legend-item">
                      <span className="adm-legend-dot dot-blue"></span>
                      <span>Granted Access</span>
                    </div>
                    <div className="adm-legend-item">
                      <span className="adm-legend-dot dot-emerald"></span>
                      <span>Standard Traders</span>
                    </div>

                    <div className="adm-timeframe-pill">
                      <span>{timeFilter}</span>
                      <span className="adm-pill-caret">▼</span>
                    </div>
                  </div>
                </div>

                {/* SVG WAVE CHART */}
                <div className="adm-chart-svg-container">
                  <svg className="adm-wave-svg" viewBox="0 0 600 180" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid Lines */}
                    <line x1="0" y1="40" x2="600" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1="90" x2="600" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1="140" x2="600" y2="140" stroke="#f1f5f9" strokeWidth="1" />

                    {/* Emerald Wave Curve */}
                    <path
                      d="M 0 120 C 100 160, 150 70, 250 110 C 350 150, 420 80, 520 90 L 600 70 L 600 180 L 0 180 Z"
                      fill="url(#emeraldGrad)"
                    />
                    <path
                      d="M 0 120 C 100 160, 150 70, 250 110 C 350 150, 420 80, 520 90 L 600 70"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Blue Wave Curve */}
                    <path
                      d="M 0 70 C 80 15, 160 140, 260 80 C 360 20, 440 120, 530 60 L 600 110 L 600 180 L 0 180 Z"
                      fill="url(#blueGrad)"
                    />
                    <path
                      d="M 0 70 C 80 15, 160 140, 260 80 C 360 20, 440 120, 530 60 L 600 110"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Marker Pill */}
                    <circle cx="210" cy="98" r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
                  </svg>

                  {/* Floating tooltip */}
                  <div className="adm-floating-marker" style={{ left: "32%", top: "35%" }}>
                    <span className="adm-marker-date">Active</span>
                    <span className="adm-marker-val">{grantedUsersCount} Granted</span>
                  </div>

                  {/* Chart X-Axis Labels */}
                  <div className="adm-chart-xaxis">
                    <span>FEB</span>
                    <span>MAR</span>
                    <span>APR</span>
                    <span>MAY</span>
                    <span>JUN</span>
                    <span>JUL</span>
                  </div>
                </div>
              </div>

              {/* CARD 2 & 3: RIGHT KPI METRIC CARDS */}
              <div className="adm-grid-kpi-col">
                {/* KPI CARD 1: Traders Onboarded */}
                <div className="adm-card adm-kpi-card">
                  <div className="adm-kpi-top">
                    <div className="adm-kpi-icon-circle bg-blue-soft">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <div className="adm-kpi-info">
                      <div className="adm-kpi-number">{totalUsersCount}</div>
                      <div className="adm-kpi-title">Traders Onboarded</div>
                    </div>
                  </div>
                  <div className="adm-kpi-footer">
                    <div className="adm-timeframe-pill small">
                      <span>All Accounts</span>
                      <span className="adm-pill-caret">▼</span>
                    </div>
                  </div>
                </div>

                {/* KPI CARD 2: Permissions Granted */}
                <div className="adm-card adm-kpi-card">
                  <div className="adm-kpi-top">
                    <div className="adm-kpi-icon-circle bg-emerald-soft">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <polyline points="9 12 11 14 15 10"></polyline>
                      </svg>
                    </div>
                    <div className="adm-kpi-info">
                      <div className="adm-kpi-number">{grantedUsersCount}</div>
                      <div className="adm-kpi-title">Strategy Access Active</div>
                    </div>
                  </div>
                  <div className="adm-kpi-footer">
                    <div className="adm-timeframe-pill small">
                      <span>Full Access</span>
                      <span className="adm-pill-caret">▼</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM ROW OF CARDS */}
            <div className="adm-grid-bottom-row">
              {/* CARD 4: CONCENTRIC DONUT CHART */}
              <div className="adm-card adm-donut-card">
                <div className="adm-card-title-row">
                  <div className="adm-card-title">Permissions Breakdown</div>
                  <div className="adm-timeframe-pill small">
                    <span>This month</span>
                    <span className="adm-pill-caret">▼</span>
                  </div>
                </div>

                <div className="adm-donut-body">
                  <div className="adm-donut-svg-wrap">
                    <svg viewBox="0 0 120 120" className="adm-donut-svg">
                      {/* Outer Ring Background */}
                      <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                      {/* Outer Ring Value (Blue - Granted) */}
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="12"
                        strokeDasharray="289"
                        strokeDashoffset={289 - (289 * (grantedUsersCount || 1)) / (totalUsersCount || 1)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                      {/* Inner Ring Background */}
                      <circle cx="60" cy="60" r="30" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                      {/* Inner Ring Value (Emerald - Standard) */}
                      <circle
                        cx="60"
                        cy="60"
                        r="30"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="10"
                        strokeDasharray="188"
                        strokeDashoffset={188 - (188 * (standardUsersCount || 1)) / (totalUsersCount || 1)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                  </div>

                  <div className="adm-donut-legend">
                    <div className="adm-donut-stat">
                      <div className="adm-legend-item">
                        <span className="adm-legend-dot dot-blue"></span>
                        <span className="adm-donut-stat-label">Granted Access</span>
                      </div>
                      <div className="adm-donut-stat-val">{grantedUsersCount}</div>
                    </div>

                    <div className="adm-donut-stat" style={{ marginTop: 12 }}>
                      <div className="adm-legend-item">
                        <span className="adm-legend-dot dot-emerald"></span>
                        <span className="adm-donut-stat-label">Standard</span>
                      </div>
                      <div className="adm-donut-stat-val">{standardUsersCount}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 5: BAR CHART WIDGET */}
              <div className="adm-card adm-bar-card">
                <div className="adm-card-title-row">
                  <div className="adm-card-title">Activity &amp; Inquiries</div>
                  <div className="adm-timeframe-pill small">
                    <span>This week</span>
                    <span className="adm-pill-caret">▼</span>
                  </div>
                </div>

                <div className="adm-bar-chart-body">
                  <div className="adm-bar-y-axis">
                    <span>300</span>
                    <span>200</span>
                    <span>100</span>
                    <span>0</span>
                  </div>

                  <div className="adm-bar-columns-wrap">
                    {[
                      { day: "M", height: "55%" },
                      { day: "T", height: "85%" },
                      { day: "W", height: "45%" },
                      { day: "Th", height: "65%" },
                      { day: "F", height: "72%" },
                      { day: "S", height: "25%" },
                    ].map((bar, i) => (
                      <div key={i} className="adm-bar-col">
                        <div className="adm-bar-track">
                          <div className="adm-bar-fill" style={{ height: bar.height }}></div>
                        </div>
                        <span className="adm-bar-label">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD 6: SECURITY HUB ACTION CARD */}
              <div className="adm-card adm-highlight-action-card">
                <div className="adm-highlight-badge">Security Hub</div>

                <div className="adm-highlight-icon-3d">
                  <div className="adm-calendar-3d-icon">
                    <div className="adm-cal-spiral">•••</div>
                    <div className="adm-cal-number">🔑</div>
                  </div>
                </div>

                <div className="adm-highlight-title">Admin Password</div>
                <div className="adm-highlight-sub">
                  Secure your master administrative credentials and manage trader access.
                </div>

                <button
                  type="button"
                  className="adm-highlight-btn"
                  onClick={handleOpenResetAdmin}
                >
                  Reset Admin Password
                </button>
              </div>
            </div>

            {/* FULL-WIDTH INTERACTIVE USER ACCOUNTS MANAGEMENT TABLE */}
            <div className="adm-card adm-table-card">
              {/* TOOLBAR WITH SEARCH BOX AND FILTERS */}
              <div className="adm-table-header">
                <div>
                  <h2 className="adm-table-title">User Accounts &amp; Credentials</h2>
                  <p className="adm-table-sub">
                    Manage system users, reset passwords, and assign institutional strategy permissions.
                  </p>
                </div>

                <div className="adm-table-actions">
                  {/* Search Box in Toolbar */}
                  <div className="adm-search-wrap">
                    <span className="adm-search-icon">🔍</span>
                    <input
                      type="text"
                      className="adm-search-input"
                      placeholder="Search by name, email, or role..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="adm-search-clear"
                        onClick={() => setSearchQuery("")}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="adm-filter-pills">
                    {[
                      { id: "all", label: "All Users" },
                      { id: "admin", label: "Admins" },
                      { id: "trader", label: "Traders" },
                      { id: "granted", label: "Granted Access" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`adm-pill-btn ${roleFilter === p.id ? "active" : ""}`}
                        onClick={() => setRoleFilter(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Add New User Button */}
                  <button
                    type="button"
                    className="adm-add-user-btn"
                    onClick={handleOpenAddUser}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add New User</span>
                  </button>
                </div>
              </div>

              {/* TABLE */}
              <div className="adm-table-wrap">
                {loadingUsers ? (
                  <div className="adm-loading-state">
                    <div className="adm-spinner"></div>
                    <span>Loading registered users...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="adm-empty-state">
                    <p>No user accounts matched your search or filters.</p>
                  </div>
                ) : (
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Strategy Access</th>
                        <th>Created</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id || u._id}>
                          <td>
                            <div className="adm-user-cell">
                              <div className="adm-avatar-tiny">
                                {u.name ? u.name.slice(0, 2).toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="adm-user-name">{u.name}</div>
                                <div className="adm-user-email">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`adm-badge-role ${u.isAdmin ? "admin" : "trader"}`}>
                              {u.isAdmin ? "👑 Admin" : "📈 Trader"}
                            </span>
                          </td>
                          <td>
                            <span className={`adm-status-badge ${u.hasAccess ? "approved" : "locked"}`}>
                              {u.hasAccess ? "✓ Granted" : "🔒 Locked"}
                            </span>
                          </td>
                          <td className="adm-date-text">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="adm-action-btns-wrap">
                              {/* RESET PASSWORD BUTTON */}
                              <button
                                type="button"
                                className="adm-reset-pwd-btn"
                                onClick={() => handleOpenResetUser(u)}
                                title={`Reset password for ${u.name}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>Reset Password</span>
                              </button>

                              {/* DELETE USER BUTTON (non-admins only) */}
                              {!u.isAdmin && (
                                <button
                                  type="button"
                                  className="adm-delete-btn"
                                  onClick={() => handleDeleteUser(u.id || u._id, u.name)}
                                  title="Delete user account"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: USERS TAB */}
        {activeNav === "users" && (
          <div className="adm-dashboard-grid-wrap">
            <div className="adm-card adm-table-card">
              <div className="adm-table-header">
                <div>
                  <h2 className="adm-table-title">All Trader &amp; Admin Accounts</h2>
                  <p className="adm-table-sub">
                    Directly reset passwords, create new accounts, and configure permissions.
                  </p>
                </div>

                <div className="adm-table-actions">
                  <div className="adm-search-wrap">
                    <span className="adm-search-icon">🔍</span>
                    <input
                      type="text"
                      className="adm-search-input"
                      placeholder="Search by name, email, or role..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="adm-search-clear"
                        onClick={() => setSearchQuery("")}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="adm-filter-pills">
                    {[
                      { id: "all", label: "All Users" },
                      { id: "admin", label: "Admins" },
                      { id: "trader", label: "Traders" },
                      { id: "granted", label: "Granted Access" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`adm-pill-btn ${roleFilter === p.id ? "active" : ""}`}
                        onClick={() => setRoleFilter(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="adm-add-user-btn"
                    onClick={handleOpenAddUser}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add New User</span>
                  </button>
                </div>
              </div>

              {/* TABLE */}
              <div className="adm-table-wrap">
                {loadingUsers ? (
                  <div className="adm-loading-state">
                    <div className="adm-spinner"></div>
                    <span>Loading registered users...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="adm-empty-state">
                    <p>No user accounts matched your search or filters.</p>
                  </div>
                ) : (
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Strategy Access</th>
                        <th>Created</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id || u._id}>
                          <td>
                            <div className="adm-user-cell">
                              <div className="adm-avatar-tiny">
                                {u.name ? u.name.slice(0, 2).toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="adm-user-name">{u.name}</div>
                                <div className="adm-user-email">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`adm-badge-role ${u.isAdmin ? "admin" : "trader"}`}>
                              {u.isAdmin ? "👑 Admin" : "📈 Trader"}
                            </span>
                          </td>
                          <td>
                            <span className={`adm-status-badge ${u.hasAccess ? "approved" : "locked"}`}>
                              {u.hasAccess ? "✓ Granted" : "🔒 Locked"}
                            </span>
                          </td>
                          <td className="adm-date-text">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="adm-action-btns-wrap">
                              <button
                                type="button"
                                className="adm-reset-pwd-btn"
                                onClick={() => handleOpenResetUser(u)}
                                title={`Reset password for ${u.name}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>Reset Password</span>
                              </button>

                              {!u.isAdmin && (
                                <button
                                  type="button"
                                  className="adm-delete-btn"
                                  onClick={() => handleDeleteUser(u.id || u._id, u.name)}
                                  title="Delete user account"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: STRATEGY ACCESS REQUESTS */}
        {activeNav === "requests" && (
          <div className="adm-embedded-wrap">
            <StrategyAccessRequestsPage />
          </div>
        )}

        {/* VIEW 4: DATA SYNC */}
        {activeNav === "datasync" && (
          <div className="adm-embedded-wrap">
            <DataSyncPage />
          </div>
        )}

        {/* VIEW 5: SECURITY & PASSWORDS HUB */}
        {activeNav === "security" && (
          <div className="adm-dashboard-grid-wrap">
            <div className="adm-card adm-security-center-card">
              <div className="adm-table-header">
                <div>
                  <h2 className="adm-table-title">Security &amp; Credentials Center</h2>
                  <p className="adm-table-sub">
                    Direct access to reset Master Admin password and configure trader credentials.
                  </p>
                </div>
              </div>

              <div className="adm-security-grid">
                {/* Admin Password Reset Card */}
                <div className="adm-sec-box">
                  <div className="adm-sec-icon">👑</div>
                  <h3 className="adm-sec-title">Master Admin Password</h3>
                  <p className="adm-sec-desc">
                    Update your personal administrative password to ensure complete security of the platform.
                  </p>
                  <button
                    type="button"
                    className="adm-highlight-btn"
                    onClick={handleOpenResetAdmin}
                  >
                    Reset Admin Password
                  </button>
                </div>

                {/* Trader Password Management */}
                <div className="adm-sec-box">
                  <div className="adm-sec-icon">👥</div>
                  <h3 className="adm-sec-title">Trader Accounts Passwords</h3>
                  <p className="adm-sec-desc">
                    Need to recover or assign a new password to a trader? Select any account from the Users list to reset.
                  </p>
                  <button
                    type="button"
                    className="adm-pill-btn active"
                    onClick={() => setActiveNav("users")}
                  >
                    Manage Trader Passwords ({users.length} Users)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: RESET OTHER USER'S PASSWORD */}
      {/* ============================================================ */}
      {resetUserModal.open && (
        <div className="adm-modal-overlay" onClick={() => setResetUserModal((p) => ({ ...p, open: false }))}>
          <div className="adm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div>
                <h3 className="adm-modal-title">Reset Password</h3>
                <p className="adm-modal-sub">
                  Assign a new password for <strong>{resetUserModal.user?.name}</strong> ({resetUserModal.user?.email})
                </p>
              </div>
              <button
                type="button"
                className="adm-modal-close-btn"
                onClick={() => setResetUserModal((p) => ({ ...p, open: false }))}
              >
                ✕
              </button>
            </div>

            {resetUserModal.error && (
              <div className="adm-modal-error">{resetUserModal.error}</div>
            )}

            <form onSubmit={handleConfirmResetUser}>
              <div className="adm-form-group">
                <label className="adm-form-label">New Password</label>
                <div className="adm-input-eye-wrap">
                  <input
                    type={resetUserModal.showPassword ? "text" : "password"}
                    className="adm-form-input"
                    placeholder="Enter at least 6 characters..."
                    value={resetUserModal.newPassword}
                    onChange={(e) =>
                      setResetUserModal((prev) => ({ ...prev, newPassword: e.target.value, error: "" }))
                    }
                    autoFocus
                  />
                  <button
                    type="button"
                    className="adm-eye-btn"
                    onClick={() =>
                      setResetUserModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                    }
                  >
                    {resetUserModal.showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div className="adm-form-group">
                <label className="adm-form-label">Confirm New Password</label>
                <input
                  type={resetUserModal.showPassword ? "text" : "password"}
                  className="adm-form-input"
                  placeholder="Re-type new password..."
                  value={resetUserModal.confirmPassword}
                  onChange={(e) =>
                    setResetUserModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: "" }))
                  }
                />
              </div>

              <div className="adm-modal-footer">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setResetUserModal((p) => ({ ...p, open: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="adm-btn-primary"
                  disabled={resetUserModal.submitting}
                >
                  {resetUserModal.submitting ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: RESET ADMIN'S OWN PASSWORD */}
      {/* ============================================================ */}
      {resetAdminModal.open && (
        <div className="adm-modal-overlay" onClick={() => setResetAdminModal((p) => ({ ...p, open: false }))}>
          <div className="adm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div>
                <h3 className="adm-modal-title">Reset Admin Password</h3>
                <p className="adm-modal-sub">
                  Change the login password for master admin account ({user?.email})
                </p>
              </div>
              <button
                type="button"
                className="adm-modal-close-btn"
                onClick={() => setResetAdminModal((p) => ({ ...p, open: false }))}
              >
                ✕
              </button>
            </div>

            {resetAdminModal.error && (
              <div className="adm-modal-error">{resetAdminModal.error}</div>
            )}

            <form onSubmit={handleConfirmResetAdmin}>
              <div className="adm-form-group">
                <label className="adm-form-label">Current Password (optional)</label>
                <input
                  type="password"
                  className="adm-form-input"
                  placeholder="Enter current password if known..."
                  value={resetAdminModal.currentPassword}
                  onChange={(e) =>
                    setResetAdminModal((prev) => ({ ...prev, currentPassword: e.target.value, error: "" }))
                  }
                />
              </div>

              <div className="adm-form-group">
                <label className="adm-form-label">New Password</label>
                <div className="adm-input-eye-wrap">
                  <input
                    type={resetAdminModal.showPassword ? "text" : "password"}
                    className="adm-form-input"
                    placeholder="Enter new password (min 6 characters)..."
                    value={resetAdminModal.newPassword}
                    onChange={(e) =>
                      setResetAdminModal((prev) => ({ ...prev, newPassword: e.target.value, error: "" }))
                    }
                  />
                  <button
                    type="button"
                    className="adm-eye-btn"
                    onClick={() =>
                      setResetAdminModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                    }
                  >
                    {resetAdminModal.showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div className="adm-form-group">
                <label className="adm-form-label">Confirm New Password</label>
                <input
                  type={resetAdminModal.showPassword ? "text" : "password"}
                  className="adm-form-input"
                  placeholder="Re-type new password..."
                  value={resetAdminModal.confirmPassword}
                  onChange={(e) =>
                    setResetAdminModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: "" }))
                  }
                />
              </div>

              <div className="adm-modal-footer">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setResetAdminModal((p) => ({ ...p, open: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="adm-btn-primary"
                  disabled={resetAdminModal.submitting}
                >
                  {resetAdminModal.submitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: ADD NEW USER */}
      {/* ============================================================ */}
      {addUserModal.open && (
        <div className="adm-modal-overlay" onClick={() => setAddUserModal((p) => ({ ...p, open: false }))}>
          <div className="adm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div>
                <h3 className="adm-modal-title">Add New User Account</h3>
                <p className="adm-modal-sub">Create a new trader or system account</p>
              </div>
              <button
                type="button"
                className="adm-modal-close-btn"
                onClick={() => setAddUserModal((p) => ({ ...p, open: false }))}
              >
                ✕
              </button>
            </div>

            {addUserModal.error && (
              <div className="adm-modal-error">{addUserModal.error}</div>
            )}

            <form onSubmit={handleConfirmAddUser}>
              <div className="adm-form-group">
                <label className="adm-form-label">Full Name</label>
                <input
                  type="text"
                  className="adm-form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={addUserModal.name}
                  onChange={(e) =>
                    setAddUserModal((prev) => ({ ...prev, name: e.target.value, error: "" }))
                  }
                  autoFocus
                />
              </div>

              <div className="adm-form-group">
                <label className="adm-form-label">Email Address</label>
                <input
                  type="email"
                  className="adm-form-input"
                  placeholder="e.g. rahul@example.com"
                  value={addUserModal.email}
                  onChange={(e) =>
                    setAddUserModal((prev) => ({ ...prev, email: e.target.value, error: "" }))
                  }
                />
              </div>

              <div className="adm-form-group">
                <label className="adm-form-label">Password</label>
                <div className="adm-input-eye-wrap">
                  <input
                    type={addUserModal.showPassword ? "text" : "password"}
                    className="adm-form-input"
                    placeholder="Min 6 characters..."
                    value={addUserModal.password}
                    onChange={(e) =>
                      setAddUserModal((prev) => ({ ...prev, password: e.target.value, error: "" }))
                    }
                  />
                  <button
                    type="button"
                    className="adm-eye-btn"
                    onClick={() =>
                      setAddUserModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                    }
                  >
                    {addUserModal.showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div className="adm-form-checkbox-row">
                <label className="adm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={addUserModal.hasAccess}
                    onChange={(e) =>
                      setAddUserModal((prev) => ({ ...prev, hasAccess: e.target.checked }))
                    }
                  />
                  <span>Grant Instant Strategy &amp; Report Access</span>
                </label>
              </div>

              <div className="adm-modal-footer">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setAddUserModal((p) => ({ ...p, open: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="adm-btn-primary"
                  disabled={addUserModal.submitting}
                >
                  {addUserModal.submitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
