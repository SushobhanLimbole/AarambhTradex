export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const ENDPOINTS = {
  AUTH: {
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    SIGNIN: `${API_BASE_URL}/auth/signin`,
    ME: `${API_BASE_URL}/auth/me`,
  },
  STRATEGY_ACCESS: {
    REQUEST: `${API_BASE_URL}/strategy-access/request`,
    STATUS: `${API_BASE_URL}/strategy-access/status`,
    MY_STATUS: `${API_BASE_URL}/strategy-access/my-status`,
    ADMIN_REQUESTS: `${API_BASE_URL}/strategy-access/requests`,
    REVIEW_REQUEST: (id) => `${API_BASE_URL}/strategy-access/requests/${id}`,
  },
};
