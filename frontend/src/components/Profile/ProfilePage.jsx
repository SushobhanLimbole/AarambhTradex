import React, { useState, useEffect } from "react";
import "./ProfilePage.css";
import { useAuth } from "../../context/AuthContext";
import strategyAccessService from "../../services/strategyAccessService";
import authService from "../../services/authService";
import Toast from "../Common/Toast";

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // For Admin: User Management state
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // New user form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserHasAccess, setNewUserHasAccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createUserSubmitting, setCreateUserSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Fetch status on mount or when user ID/admin status changes
  useEffect(() => {
    if (user) {
      if (!user.isAdmin) {
        fetchMyStatus();
      } else {
        fetchAdminUsers();
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
          if (prev.hasAccess === res.data.hasAccess) return prev;
          return { ...prev, hasAccess: res.data.hasAccess };
        });
      }
    } catch (err) {
      console.error("Failed to fetch access status:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await authService.adminGetUsers();
      if (res.data?.users) {
        setAdminUsers(res.data.users);
      }
    } catch (err) {
      console.error("Failed to fetch user list:", err);
      setToast({ message: "Failed to load user accounts list.", type: "error" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateNewUser = () => {
    const errors = {};
    if (!newUserName.trim()) errors.name = "Full name is required";
    if (!newUserEmail.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!newUserPassword) {
      errors.password = "Password is required";
    } else if (newUserPassword.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!validateNewUser()) return;

    try {
      setCreateUserSubmitting(true);
      await authService.adminCreateUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        hasAccess: newUserHasAccess,
      });

      setToast({ message: `User "${newUserName.trim()}" created successfully!`, type: "success" });
      setShowAddUserModal(false);
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserHasAccess(false);
      setFormErrors({});
      // Refresh user list
      fetchAdminUsers();
    } catch (err) {
      setToast({ message: err.message || "Failed to create user account.", type: "error" });
    } finally {
      setCreateUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"?`)) return;

    try {
      await authService.adminDeleteUser(userId);
      setToast({ message: `User "${userName}" deleted successfully.`, type: "success" });
      fetchAdminUsers();
    } catch (err) {
      setToast({ message: err.message || "Failed to delete user account.", type: "error" });
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
      await strategyAccessService.requestAccess();
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

        {/* ADMIN USER MANAGEMENT SECTION */}
        {user?.isAdmin ? (
          <>
            <hr className="card-divider" />
            <div className="admin-user-mgmt-section">
              <div className="admin-user-mgmt-header">
                <div>
                  <h3 className="access-title">User Accounts Management</h3>
                  <p className="access-desc">
                    Create and manage authorized trader accounts and institutional strategy permissions.
                  </p>
                </div>
                <button
                  className="add-user-btn"
                  onClick={() => {
                    setFormErrors({});
                    setShowAddUserModal(true);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Add New User</span>
                </button>
              </div>

              {/* USER ACCOUNTS TABLE */}
              <div className="user-table-wrap">
                {loadingUsers ? (
                  <div className="user-loading-state">
                    <div className="spinner"></div>
                    <span>Loading registered users...</span>
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="user-empty-state">
                    <p>No user accounts found. Click "Add New User" to register the first trader.</p>
                  </div>
                ) : (
                  <table className="user-mgmt-table">
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
                      {adminUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar-tiny">
                                {u.name ? u.name.slice(0, 2).toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="user-name-text">{u.name}</div>
                                <div className="user-email-text">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge-role ${u.isAdmin ? "admin" : "trader"}`}>
                              {u.isAdmin ? "Admin" : "Trader"}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${u.hasAccess ? "approved" : "none"}`}>
                              {u.hasAccess ? "Granted" : "Locked"}
                            </span>
                          </td>
                          <td className="user-date-text">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {!u.isAdmin && (
                              <button
                                className="user-delete-btn"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                title="Delete user account"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <span>Delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : (
          /* STRATEGY ACCESS CONTROL SECTION (VISIBLE ONLY TO REGULAR TRADERS) */
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

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7.5" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                </div>
                <div>
                  <h3 className="modal-title">Create New User</h3>
                  <p className="modal-subtitle">Add a trader account with credentials and strategy permissions</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddUserModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? "input-error" : ""}`}
                  placeholder="e.g. Rahul Sharma"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className={`form-input ${formErrors.email ? "input-error" : ""}`}
                  placeholder="e.g. trader@aarambhtradex.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
                {formErrors.email && <span className="field-error">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className={`form-input ${formErrors.password ? "input-error" : ""}`}
                    placeholder="Min. 6 characters"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {formErrors.password && <span className="field-error">{formErrors.password}</span>}
              </div>

              <div className="form-group checkbox-group">
                <label className="custom-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newUserHasAccess}
                    onChange={(e) => setNewUserHasAccess(e.target.checked)}
                  />
                  <span className="checkbox-text">
                    <strong>Grant Immediate Strategy Access</strong>
                    <small>User will immediately have access to institutional reports and strategy matrix.</small>
                  </span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={createUserSubmitting}
                >
                  {createUserSubmitting ? "Creating User..." : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

