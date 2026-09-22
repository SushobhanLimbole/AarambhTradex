import React, { useState, useEffect } from "react";
import "./ProfilePage.css";
import { useAuth } from "../../context/AuthContext";
import strategyAccessService from "../../services/strategyAccessService";
import Toast from "../Common/Toast";

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // For Admin: view all user requests
  const [adminRequests, setAdminRequests] = useState([]);

  // Fetch status on mount or when user ID/admin status changes
  useEffect(() => {
    if (user) {
      fetchMyStatus();
      if (user.isAdmin) {
        fetchAdminRequests();
      }
    }
  }, [user?.id, user?.isAdmin]);

  const fetchMyStatus = async () => {
    try {
      setLoadingRequests(true);
      const res = await strategyAccessService.getMyStatus();
      if (res.data?.requests) {
        setRequests(res.data.requests);
      }
      if (res.data?.hasAccess !== undefined) {
        setUser((prev) => {
          if (!prev) return prev;
          if (prev.hasAccess === res.data.hasAccess) return prev; // keep same object reference if unchanged
          return { ...prev, hasAccess: res.data.hasAccess };
        });
      }
    } catch (err) {
      console.error("Failed to fetch access status:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchAdminRequests = async () => {
    try {
      const res = await strategyAccessService.getAllRequests();
      if (res.data?.requests) {
        setAdminRequests(res.data.requests);
      }
    } catch (err) {
      console.error("Failed to fetch admin requests:", err);
    }
  };

  const latestRequest = requests.length > 0 ? requests[0] : null;
  const currentStatus = latestRequest ? latestRequest.status : "none";

  const handleRequestAccess = async () => {
    if (user?.hasAccess) {
      setToast({ message: "You already have full strategy access granted!", type: "info" });
      return;
    }

    if (currentStatus === "pending") {
      setToast({ message: "Your strategy access request is already pending review.", type: "info" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await strategyAccessService.requestAccess();
      setToast({ message: "Strategy access request submitted successfully to Admin!", type: "success" });
      await fetchMyStatus();
    } catch (err) {
      setToast({ message: err.message || "Failed to submit strategy access request.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClick = () => {
    if (user?.hasAccess) {
      setToast({ message: "Strategy Access is active and granted by Admin.", type: "info" });
    } else if (currentStatus === "pending") {
      setToast({ message: "Strategy Access toggle will turn ON once Admin approves your pending request.", type: "info" });
    } else {
      handleRequestAccess();
    }
  };

  const handleAdminReview = async (requestId, action) => {
    try {
      await strategyAccessService.reviewAccessRequest(requestId, action);
      setToast({ message: `Request ${action}d successfully!`, type: "success" });
      fetchAdminRequests();
      fetchMyStatus();
    } catch (err) {
      setToast({ message: err.message || "Failed to process review.", type: "error" });
    }
  };

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "U";

  return (
    <div className="profile-container">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />

      {/* FUSED SINGLE PROFILE CARD */}
      <div className="unified-card">
        {/* USER DETAILS HEADER */}
        <div className="profile-header">
          <div className="profile-header-left">
            <div className="profile-big-avatar">{initials}</div>
            <div>
              <h2 className="profile-info-name">{user?.name || "User Name"}</h2>
              <p className="profile-info-email">{user?.email || "user@example.com"}</p>
              <span className={`badge-role ${user?.isAdmin ? "admin" : "trader"}`}>
                {user?.isAdmin ? "👑 System Admin" : "📈 Trader Account"}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            Sign Out
          </button>
        </div>

        {/* STRATEGY ACCESS CONTROL SECTION (VISIBLE ONLY TO REGULAR TRADERS) */}
        {!user?.isAdmin && (
          <>
            <hr className="card-divider" />
            <div className="access-section">
              <div className="access-title-wrap">
                <h3 className="access-title">Institutional Strategy Access</h3>
                <p className="access-desc">
                  Enable access to institutional matrix algorithms, backtesting engines, and signals.
                </p>
              </div>

              {/* TOGGLE ROW */}
              <div className="toggle-card-row">
                <div className="toggle-info">
                  <span className="toggle-label">Strategy Access</span>
                  <span className="toggle-sub">
                    {user?.hasAccess
                      ? "Access active. You can view institutional strategy reports."
                      : currentStatus === "pending"
                      ? "Request pending. Awaiting Admin approval."
                      : "Access locked. Click 'Get Access' to request strategy permission."}
                  </span>
                </div>

                <label className="switch" onClick={handleToggleClick}>
                  <input type="checkbox" checked={Boolean(user?.hasAccess)} readOnly />
                  <span className="slider"></span>
                </label>
              </div>

              {/* GET ACCESS BUTTON (If access not granted) */}
              {!user?.hasAccess && (
                <div style={{ marginBottom: 20 }}>
                  <button
                    className="get-access-btn"
                    onClick={handleRequestAccess}
                    disabled={submitting || currentStatus === "pending"}
                  >
                    {submitting
                      ? "Submitting Request..."
                      : currentStatus === "pending"
                      ? "Access Request Pending..."
                      : "Get Access"}
                  </button>
                </div>
              )}

              {/* REQUEST STATUS BOX */}
              <div className={`status-box ${user?.hasAccess ? "approved" : currentStatus}`}>
                <div>
                  <div className="status-box-title">CURRENT PERMISSION STATUS</div>
                  <div className="status-box-value">
                    {user?.hasAccess
                      ? "Access Granted"
                      : currentStatus === "pending"
                      ? "Pending Admin Approval"
                      : currentStatus === "rejected"
                      ? "Access Request Rejected"
                      : "No Request Submitted"}
                  </div>
                </div>

                <span className={`status-badge ${user?.hasAccess ? "approved" : currentStatus}`}>
                  {user?.hasAccess ? "GRANTED" : currentStatus.toUpperCase()}
                </span>
              </div>

              {/* ADMIN NOTE (IF PROVIDED) */}
              {latestRequest?.adminNote && (
                <div className="admin-note-banner">
                  <span className="admin-note-label">📝 Note from Admin:</span>
                  <p className="admin-note-text">"{latestRequest.adminNote}"</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
