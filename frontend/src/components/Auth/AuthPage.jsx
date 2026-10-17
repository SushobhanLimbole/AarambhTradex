import React, { useState, useEffect, useRef } from "react";
import "./AuthPage.css";
import StockAnalytics from "../Home/StockAnalytics";
import MainLayout from "../Home/MainLayout";
import logoImg from "../../assets/logo.jpeg";
import { useAuth } from "../../context/AuthContext";
import Toast from "../Common/Toast";

/* ---------------------------------------------------------
   LIVE MARKET DATA — Angel One SmartAPI
   Real-time live prices directly from Angel One SmartAPI.
   Zero simulated or fabricated numbers.
--------------------------------------------------------- */
const INITIAL_WATCHLIST = [
  { symbol: "NIFTY", label: "NIFTY 50", sub: "Nifty 50 Index", currency: "₹" },
  { symbol: "BANKNIFTY", label: "BANK NIFTY", sub: "Nifty Bank Index", currency: "₹" },
  { symbol: "SENSEX", label: "SENSEX", sub: "S&P BSE Sensex", currency: "₹" },
  { symbol: "FINNIFTY", label: "FIN NIFTY", sub: "Financial Services", currency: "₹" },
  { symbol: "NIFTYNEXT50", label: "NEXT 50", sub: "Nifty Next 50", currency: "₹" },
  { symbol: "INDIAVIX", label: "INDIA VIX", sub: "Volatility Index", currency: "" },
  { symbol: "RELIANCE", label: "RELIANCE", sub: "Reliance Industries", currency: "₹" },
  { symbol: "TCS", label: "TCS", sub: "Tata Consultancy Services", currency: "₹" },
  { symbol: "HDFCBANK", label: "HDFC BANK", sub: "HDFC Bank Ltd", currency: "₹" },
  { symbol: "INFY", label: "INFOSYS", sub: "Infosys Limited", currency: "₹" },
  { symbol: "ICICIBANK", label: "ICICI BANK", sub: "ICICI Bank Ltd", currency: "₹" },
  { symbol: "SBIN", label: "SBI", sub: "State Bank of India", currency: "₹" },
  { symbol: "BHARTIARTL", label: "BHARTI AIRTEL", sub: "Bharti Airtel Ltd", currency: "₹" },
  { symbol: "ITC", label: "ITC", sub: "ITC Limited", currency: "₹" },
  { symbol: "TATAMOTORS", label: "TATA MOTORS", sub: "Tata Motors Ltd", currency: "₹" },
  { symbol: "LT", label: "L&T", sub: "Larsen & Toubro Ltd", currency: "₹" },
  { symbol: "GOLD", label: "GOLD", sub: "MCX Gold Futures", currency: "₹" },
  { symbol: "SILVER", label: "SILVER", sub: "MCX Silver Futures", currency: "₹" },
];

/* Sparkline built from genuine live fetched prices only —
   each symbol accumulates history of real prices and draws
   a sparkline. If less than 2 live updates, a placeholder
   dash is shown rather than fabricating data. */
function makeSpark(history) {
  if (!history || history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || Math.abs(min) * 0.001 || 1;
  const step = 70 / (history.length - 1);
  return history
    .map((p, i) => {
      const norm = ((p - min) / range) * 20 + 2; // 2..22
      return `${(i * step).toFixed(1)},${(24 - norm).toFixed(1)}`;
    })
    .join(" ");
}

function buildInitialQuotes() {
  return INITIAL_WATCHLIST.map((item) => ({
    ...item,
    price: null,
    changePct: null,
    up: true,
    history: [],
    spark: null,
    unavailable: false,
  }));
}

function StockTicker() {
  const [quotes, setQuotes] = useState(buildInitialQuotes);
  const [live, setLive] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let pollInterval = null;

    const fetchLiveQuotes = async () => {
      try {
        const res = await fetch("/api/market/live-quotes", {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!mounted.current || !data.success || !Array.isArray(data.quotes)) return;

        setQuotes((prev) => {
          const freshMap = new Map();
          data.quotes.forEach((q) => freshMap.set(q.symbol, q));

          return prev.map((item) => {
            const fresh = freshMap.get(item.symbol);
            if (!fresh) return item;

            if (fresh.price != null && isFinite(fresh.price)) {
              // Real live price received
              const history = [...(item.history || []), fresh.price].slice(-16);
              const up = (fresh.changePct ?? 0) >= 0;

              return {
                ...item,
                label: fresh.label || item.label,
                sub: fresh.sub || item.sub,
                currency: fresh.currency ?? item.currency,
                price: fresh.price,
                changePct: fresh.changePct,
                netChange: fresh.netChange,
                up,
                history,
                spark: makeSpark(history),
                unavailable: false,
              };
            }

            // Only mark unavailable if we don't have any prior live price
            if (item.price != null) return item;
            return { ...item, unavailable: true };
          });
        });

        setLive(true);
      } catch (err) {
        if (!mounted.current) return;
        // On error, keep existing prices if present, otherwise keep fetching state
      }
    };

    // Initial immediate fetch
    fetchLiveQuotes();

    // Poll Angel One SmartAPI live data every 10 seconds
    pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLiveQuotes();
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLiveQuotes();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted.current = false;
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const formatPrice = (item) => {
    if (item.price == null) return item.unavailable ? "Unavailable" : "Fetching…";
    const decimals = item.price < 10 ? 4 : 2;
    const val = item.price.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${item.currency}${val}`;
  };

  const doubled = [...quotes, ...quotes];

  return (
    <div className="amu-ticker">
      <div className="amu-ticker-head">
        <span className="amu-live-dot" data-live={live}></span>
        <span>{live ? "Live • Data" : "Connecting to live market data…"}</span>
      </div>
      <div className="amu-ticker-mask">
        <div className="amu-ticker-track">
          {doubled.map((q, i) => (
            <div className="amu-tick-card" key={`${q.label}-${i}`}>
              <div className="amu-tick-left">
                <div className="amu-tick-name">{q.label}</div>
                <div className="amu-tick-sub">{q.sub}</div>
              </div>
              <svg className="amu-tick-spark" viewBox="0 0 70 24" preserveAspectRatio="none">
                {q.spark ? (
                  <polyline
                    points={q.spark}
                    fill="none"
                    stroke={q.up ? "#16a34a" : "#dc2626"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <line
                    x1="0"
                    y1="12"
                    x2="70"
                    y2="12"
                    stroke="#b8c9dd"
                    strokeWidth="1"
                    strokeDasharray="2,3"
                  />
                )}
              </svg>
              <div className="amu-tick-right">
                <div className="amu-tick-price">{formatPrice(q)}</div>
                <div className={`amu-tick-badge ${q.changePct == null ? "" : q.up ? "up" : "down"}`}>
                  {q.changePct == null ? "" : `${q.up ? "+" : ""}${q.changePct.toFixed(2)}%`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   VALIDATION HELPERS
   Every field shows exactly one line if it's invalid: a
   generic "This field is required" when empty, or a single
   format message where an empty check isn't enough (email).
--------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLogin({ email, password, agree }) {
  const errors = {};
  if (!email.trim()) {
    errors.email = "This field is required";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address";
  }
  if (!password) {
    errors.password = "This field is required";
  }
  if (!agree) {
    errors.agree = "Please accept the Terms & Conditions to sign in";
  }
  return errors;
}

export default function AuthPage() {
  const { login, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState({});
  const [serverLoginError, setServerLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const handleLoginSubmit = async () => {
    setServerLoginError("");
    const errors = validateLogin({ email: loginEmail, password: loginPassword, agree });
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoginSubmitting(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
      try {
        window.history.replaceState({ tab: "symbols" }, "", window.location.pathname + "#symbols");
      } catch (_) {}
      setToast({ message: "Signed in successfully! Welcome back.", type: "success" });
    } catch (err) {
      const is504 = err.status === 504 || (err.message && (err.message.includes("504") || err.message.toLowerCase().includes("timed out")));
      if (is504) {
        setServerLoginError({
          is504: true,
          message: "Gateway Timeout (504): The server was busy processing market data. Please click Retry below.",
        });
      } else {
        setServerLoginError({
          is504: false,
          message: err.message || "Authentication failed. Please check your credentials.",
        });
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Once login succeeds, route straight into the main layout
  if (isAuthenticated) {
    return <MainLayout />;
  }

  return (
    <div className="amu-wrap">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />
      <div className="amu-card">
        <div className="amu-left">
          <div className="amu-topbar">
            <div className="amu-logo">Aarambh TradeX</div>
          </div>

          <StockTicker />
        </div>

        <div className="amu-right">
          <div className="amu-right-header">
            <img src={logoImg} alt="Aarambh Tradex Logo" className="amu-brand-logo" />
            <div className="amu-brand-tagline">Aarambh. Analyze. Ascend.</div>
          </div>

          <h1 className="amu-title">Welcome back</h1>
          <p className="amu-subtitle">
            Sign in to access your Aarambh Tradex terminal
          </p>

          {serverLoginError && (
            <div className="amu-server-error" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚠️</span>
                <span>{typeof serverLoginError === "object" ? serverLoginError.message : serverLoginError}</span>
              </div>
              {serverLoginError?.is504 && (
                <button
                  type="button"
                  onClick={handleLoginSubmit}
                  disabled={loginSubmitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    border: "1px solid #f87171",
                    borderRadius: "6px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "700",
                    marginTop: "2px",
                  }}
                >
                  ↻ {loginSubmitting ? "Retrying..." : "Retry Sign In"}
                </button>
              )}
            </div>
          )}

          <div className="amu-field-wrap">
            <input
              className={`amu-field amu-field-single ${loginErrors.email ? "amu-field-error" : ""}`}
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
            />
            {loginErrors.email && <span className="amu-error">{loginErrors.email}</span>}
          </div>

          <div className="amu-field-wrap">
            <input
              className={`amu-field ${loginErrors.password ? "amu-field-error" : ""}`}
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
            />
            <button
              className="amu-eye"
              onClick={() => setShowPassword((s) => !s)}
              type="button"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {loginErrors.password && <span className="amu-error">{loginErrors.password}</span>}
          </div>

          <label className="amu-terms">
            <input
              type="checkbox"
              className="amu-checkbox"
              checked={agree}
              onChange={() => {
                const nextVal = !agree;
                setAgree(nextVal);
                if (nextVal && loginErrors.agree) {
                  setLoginErrors((prev) => ({ ...prev, agree: undefined }));
                }
              }}
            />
            <span className="amu-terms-text">
              I agree to the{" "}
              <button
                type="button"
                className="amu-link amu-terms-link"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTermsModal(true);
                }}
              >
                Terms &amp; Conditions
              </button>
            </span>
          </label>
          {loginErrors.agree && <span className="amu-error">{loginErrors.agree}</span>}

          <div style={{ marginBottom: 20 }}></div>

          <button
            className="amu-submit"
            type="button"
            onClick={handleLoginSubmit}
            disabled={loginSubmitting}
          >
            {loginSubmitting ? "Logging in..." : "Log in"}
          </button>
        </div>
      </div>

      {showTermsModal && (
        <TermsModal
          onClose={() => setShowTermsModal(false)}
          onAccept={() => {
            setAgree(true);
            setLoginErrors((prev) => ({ ...prev, agree: undefined }));
            setShowTermsModal(false);
          }}
        />
      )}
    </div>
  );
}

function TermsModal({ onClose, onAccept }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="amu-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="amu-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="amu-modal-header">
          <div className="amu-modal-title-wrap">
            <div className="amu-modal-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f7de1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h2 className="amu-modal-title">Terms &amp; Conditions</h2>
              <p className="amu-modal-subtitle">Aarambh Tradex • Terms of Service &amp; Risk Agreement</p>
            </div>
          </div>
          <button className="amu-modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="amu-modal-body">
          <div className="amu-modal-notice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Please review these terms carefully before creating an account on Aarambh Tradex.</span>
          </div>

          <div className="amu-modal-section">
            <h4>1. Acceptance of Terms</h4>
            <p>
              By registering, accessing, or using Aarambh Tradex, you confirm that you are at least 18 years of age and agree to comply with and be bound by these Terms and Conditions along with our Privacy Policy.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>2. Account Registration &amp; Security</h4>
            <p>
              You agree to provide accurate, current, and complete registration details. You are solely responsible for maintaining the confidentiality of your credentials and all activities occurring under your account.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>3. Market Data &amp; Analytics</h4>
            <p>
              Real-time quotes, technical charts, indicators, and analytics available on Aarambh Tradex are provided for informational and educational purposes only. While we aim for high accuracy, we do not guarantee uninterrupted or error-free market feeds.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>4. Financial &amp; Investment Risk Disclaimer</h4>
            <p>
              Trading in equities, derivatives, commodities, foreign exchange, and cryptocurrencies carries substantial financial risk. Losses can exceed deposits. Aarambh Tradex does not provide personalized investment advice or guarantee any trading returns.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>5. User Conduct &amp; Platform Integrity</h4>
            <p>
              You agree not to engage in unauthorized data scraping, automated abuse, account sharing, or actions that compromise platform integrity, availability, or other users&apos; security.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>6. Privacy &amp; Data Protection</h4>
            <p>
              Your data is collected and processed in accordance with industry security standards and our Privacy Policy. We do not sell your personal trading information to unauthorized third parties.
            </p>
          </div>

          <div className="amu-modal-section">
            <h4>7. Amendments &amp; Termination</h4>
            <p>
              Aarambh Tradex reserves the right to update these terms or suspend/terminate accounts that violate our safety policies. If you have any questions, concerns, or need assistance regarding these terms or your account, please contact our support team at <a href="mailto:aarambhTradex@gmail.com">aarambhTradex@gmail.com</a>.
            </p>
          </div>

        </div>

        <div className="amu-modal-footer">
          <button type="button" className="amu-modal-btn amu-modal-btn-secondary" onClick={onClose}>
            Decline
          </button>
          <button type="button" className="amu-modal-btn amu-modal-btn-primary" onClick={onAccept}>
            I Agree &amp; Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 3.19M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.6 5.6C41.6 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.396 2.11-1.19 2.91-.9.9-2.03 1.42-3.06 1.34-.13-1.11.39-2.25 1.17-3.02.78-.76 2.1-1.32 3.08-1.23zM20.9 17.27c-.32.74-.7 1.42-1.13 2.06-.6.87-1.09 1.47-1.47 1.8-.59.55-1.22.84-1.9.85-.49 0-1.08-.14-1.76-.42-.68-.28-1.31-.42-1.88-.42-.6 0-1.24.14-1.94.42-.7.28-1.26.43-1.69.44-.65.03-1.29-.27-1.92-.88-.41-.36-.92-.97-1.53-1.85-.66-.94-1.2-2.03-1.62-3.27-.45-1.34-.68-2.63-.68-3.88 0-1.44.31-2.68.93-3.72.49-.84 1.14-1.5 1.96-1.99.82-.49 1.7-.74 2.65-.76.51 0 1.18.16 2.02.47.84.31 1.38.47 1.62.47.18 0 .78-.19 1.79-.55.96-.34 1.77-.48 2.43-.43 1.79.14 3.14.85 4.03 2.13-1.6.97-2.4 2.33-2.38 4.08.02 1.36.51 2.49 1.47 3.39.44.42.93.74 1.48.97-.12.35-.25.68-.4 1z" />
    </svg>
  );
}
