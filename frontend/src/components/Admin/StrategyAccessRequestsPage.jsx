import React, { useState, useEffect } from "react";
import "./StrategyAccessRequestsPage.css";
import strategyAccessService from "../../services/strategyAccessService";
import Toast from "../Common/Toast";

export default function StrategyAccessRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState({ message: "", type: "info" });

  // State to track active decline note input for requests: { [requestId]: { open: boolean, note: string } }
  const [declineState, setDeclineState] = useState({});

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const filter = statusFilter === "all" ? "" : statusFilter;
      const res = await strategyAccessService.getAllRequests(filter);
      if (res.data?.requests) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      setToast({ message: err.message || "Failed to fetch strategy access requests.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecline = (requestId) => {
    setDeclineState((prev) => ({
      ...prev,
      [requestId]: { open: true, note: "" },
    }));
  };

  const handleCloseDecline = (requestId) => {
    setDeclineState((prev) => ({
      ...prev,
      [requestId]: { open: false, note: "" },
    }));
  };

  const handleNoteChange = (requestId, value) => {
    setDeclineState((prev) => ({
      ...prev,
      [requestId]: { ...prev[requestId], note: value },
    }));
  };

  const handleReview = async (requestId, action, adminNote = "") => {
    try {
      await strategyAccessService.reviewAccessRequest(requestId, action, adminNote);
      setToast({
        message: `Strategy access request ${action === "accept" ? "approved" : "declined"} successfully!`,
        type: "success",
      });
      handleCloseDecline(requestId);
      fetchRequests();
    } catch (err) {
      setToast({ message: err.message || "Failed to process request review.", type: "error" });
    }
  };

  return (
    <div className="requests-container">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />

      <div className="requests-card">
        <div className="requests-header">
          <div>
            <h2 className="requests-title">📋 Strategy Access Requests</h2>
            <p className="requests-sub">Manage user permissions for institutional trading strategy access.</p>
          </div>

          <div className="filter-pills">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <button
                key={s}
                className={`pill-btn ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#64748b", padding: "20px 0" }}>Loading access requests...</p>
        ) : requests.length === 0 ? (
          <p style={{ color: "#64748b", padding: "20px 0" }}>No strategy access requests found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="req-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Requested Date</th>
                  <th>Status</th>
                  <th>Note / Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const declineInfo = declineState[req._id] || { open: false, note: "" };

                  return (
                    <React.Fragment key={req._id}>
                      <tr className={declineInfo.open ? "active-decline-row" : ""}>
                        <td>
                          <strong style={{ color: "#0f172a" }}>{req.user?.name || "Unknown User"}</strong>
                        </td>
                        <td>{req.user?.email || "Unknown Email"}</td>
                        <td>{new Date(req.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`status-badge ${req.status}`}>{req.status}</span>
                        </td>
                        <td>
                          {req.adminNote ? (
                            <span style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
                              "{req.adminNote}"
                            </span>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                        <td>
                          {req.status === "pending" ? (
                            <div className="action-btn-group">
                              <button
                                className="btn-accept"
                                onClick={() => handleReview(req._id, "accept")}
                              >
                                Accept
                              </button>
                              <button
                                className="btn-decline"
                                onClick={() => handleOpenDecline(req._id)}
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 13 }}>Reviewed</span>
                          )}
                        </td>
                      </tr>

                      {/* FULL SECTION WIDTH EXPANDED DECLINE TEXTFIELD ROW */}
                      {declineInfo.open && (
                        <tr className="decline-expanded-row">
                          <td colSpan={6}>
                            <div className="decline-box-full">
                              <span className="decline-header-title">
                                ⚠️ Decline Strategy Access for {req.user?.name || "User"}
                              </span>

                              <input
                                type="text"
                                className="decline-input-full"
                                placeholder="Enter optional reason or note for declining strategy access..."
                                value={declineInfo.note}
                                onChange={(e) => handleNoteChange(req._id, e.target.value)}
                                autoFocus
                              />

                              <div className="decline-actions-full">
                                <button
                                  className="btn-cancel-decline"
                                  onClick={() => handleCloseDecline(req._id)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-confirm-decline"
                                  onClick={() => handleReview(req._id, "decline", declineInfo.note)}
                                >
                                  Confirm Decline
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
