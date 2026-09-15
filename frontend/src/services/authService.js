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
   * Logout user and clear stored token
   */
  logout() {
    localStorage.removeItem("token");
  },
};

export default authService;
