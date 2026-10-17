import { apiClient } from "./apiClient.js";
import { ENDPOINTS } from "../config/api.config.js";

/**
 * Auth Service containing user authentication API calls
 */
export const authService = {
  /**
   * Register a new user
   * @param {Object} userData - { name, email, password, isAdmin? }
   */
  async signup(userData) {
    const data = await apiClient(ENDPOINTS.AUTH.SIGNUP, {
      method: "POST",
      body: userData,
    });

    if (data.data?.token) {
      localStorage.setItem("token", data.data.token);
    }

    return data;
  },

  /**
   * Sign in an existing user
   * @param {Object} credentials - { email, password }
   */
  async signin(credentials) {
    const data = await apiClient(ENDPOINTS.AUTH.SIGNIN, {
      method: "POST",
      body: credentials,
    });

    if (data.data?.token) {
      localStorage.setItem("token", data.data.token);
    }

    return data;
  },

  /**
   * Get current authenticated user profile
   */
  async getProfile() {
    return await apiClient(ENDPOINTS.AUTH.ME, {
      method: "GET",
    });
  },

  /**
   * Admin: Create a new user account
   * @param {Object} userData - { name, email, password, hasAccess }
   */
  async adminCreateUser(userData) {
    return await apiClient(ENDPOINTS.AUTH.ADMIN_CREATE_USER, {
      method: "POST",
      body: userData,
    });
  },

  /**
   * Admin: Get all user accounts
   */
  async adminGetUsers() {
    return await apiClient(ENDPOINTS.AUTH.ADMIN_USERS, {
      method: "GET",
    });
  },

  /**
   * Admin: Delete a user account by ID
   * @param {string} userId
   */
  async adminDeleteUser(userId) {
    return await apiClient(ENDPOINTS.AUTH.ADMIN_DELETE_USER(userId), {
      method: "DELETE",
    });
  },

  /**
   * Admin: Reset a user's password (or admin's own password)
   * @param {string} userId
   * @param {string} newPassword
   */
  async adminResetPassword(userId, newPassword) {
    return await apiClient(ENDPOINTS.AUTH.ADMIN_RESET_PASSWORD(userId), {
      method: "POST",
      body: { newPassword },
    });
  },

  /**
   * Change current user's password
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  async changePassword(currentPassword, newPassword) {
    return await apiClient(ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },

  /**
   * Logout user and clear stored token
   */
  logout() {
    localStorage.removeItem("token");
  },
};

export default authService;

