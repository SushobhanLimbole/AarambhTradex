import React, { createContext, useContext, useState, useEffect } from "react";
import authService from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on mount if token exists
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          const res = await authService.getProfile();
          if (res.data?.user) {
            setUser(res.data.user);
            setToken(storedToken);
          } else {
            authService.logout();
            setUser(null);
            setToken(null);
          }
        } catch {
          authService.logout();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }

    restoreSession();
  }, []);

  const signup = async ({ name, email, password }) => {
    const res = await authService.signup({ name, email, password });
    if (res.data?.user && res.data?.token) {
      setUser(res.data.user);
      setToken(res.data.token);
    }
    return res;
  };

  const login = async ({ email, password }) => {
    const res = await authService.signin({ email, password });
    if (res.data?.user && res.data?.token) {
      setUser(res.data.user);
      setToken(res.data.token);
    }
    return res;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch (_) {}
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user),
    loading,
    signup,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
