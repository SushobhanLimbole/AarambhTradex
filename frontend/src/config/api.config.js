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
  STOCKS: {
    GET_ALL: `${API_BASE_URL}/stocks`,
    GET_LATEST_ALL: `${API_BASE_URL}/stocks/latest`,
    GET_BY_TIMEFRAME: (symbol) => `${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}`,
    GET_SYMBOLS: `${API_BASE_URL}/stocks/symbols`,
    CREATE: `${API_BASE_URL}/stocks`,
    BULK_CREATE: `${API_BASE_URL}/stocks/bulk`,
    UPDATE_ALL: `${API_BASE_URL}/stocks`,
    DELETE_ALL: `${API_BASE_URL}/stocks`,
    GET_BY_ID: (id) => `${API_BASE_URL}/stocks/record/${id}`,
    UPDATE: (id) => `${API_BASE_URL}/stocks/record/${id}`,
    DELETE: (id) => `${API_BASE_URL}/stocks/record/${id}`,
    DELETE_BY_SYMBOL: (symbol) => `${API_BASE_URL}/stocks/symbol/${encodeURIComponent(symbol)}`,
  },
  SCREENER: {
    RUN: `${API_BASE_URL}/screener`,
  },
  STRATEGY: {
    CALCULATE: `${API_BASE_URL}/strategy/calculate`,
  },
};
