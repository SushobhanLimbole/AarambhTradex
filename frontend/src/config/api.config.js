export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const ENDPOINTS = {
  AUTH: {
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    SIGNIN: `${API_BASE_URL}/auth/signin`,
    ME: `${API_BASE_URL}/auth/me`,
    ADMIN_CREATE_USER: `${API_BASE_URL}/auth/admin/create-user`,
    ADMIN_USERS: `${API_BASE_URL}/auth/admin/users`,
    ADMIN_DELETE_USER: (id) => `${API_BASE_URL}/auth/admin/users/${encodeURIComponent(id)}`,
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
  SYMBOLS: {
    GET_META: `${API_BASE_URL}/symbols/meta`,
    GET_ALL: `${API_BASE_URL}/symbols`,
    GET_BY_ID: (id) => `${API_BASE_URL}/symbols/${encodeURIComponent(id)}`,
    CREATE: `${API_BASE_URL}/symbols`,
    UPDATE: (id) => `${API_BASE_URL}/symbols/${encodeURIComponent(id)}`,
    DELETE: (id) => `${API_BASE_URL}/symbols/${encodeURIComponent(id)}`,
  },
  TREND_REPORT: {
    SCAN: `${API_BASE_URL}/trend-report`,
  },
  AB_TOP_BOTTOM: {
    SCAN: `${API_BASE_URL}/ab-top-bottom`,
  },
  TREND_REVERSAL: {
    SCAN: `${API_BASE_URL}/trend-reversal`,
  },
  CB_REPORT: {
    SCAN: `${API_BASE_URL}/cb-report`,
  },
  HIGHEST_CLOSING: {
    SCAN: `${API_BASE_URL}/highest-closing`,
  },
  DD_REPORT: {
    SCAN: `${API_BASE_URL}/dd-report`,
  },
};
