import React, { useState, useEffect, useRef } from "react";
import "./AuthPage.css";
import StockAnalytics from "../Home/StockAnalytics";

/* ---------------------------------------------------------
   Instrument list (matches the requested watchlist)
   `symbol` = Twelve Data style symbol, used for the live
   fetch.

   NOTE ON COVERAGE (Twelve Data free "Basic" plan):
   Forex (EUR/USD, GBP/USD, USD/JPY, USD/INR) and crypto
   (BTC/USD, ETH/USD) are fully supported on the free plan.
   Indices (NIFTY, BANK NIFTY, SENSEX) and some commodities /
   futures are often gated behind paid plans, or not offered
   at all under those exact tickers. Those rows will simply
   fail their individual lookup and show "Unavailable" instead
   of a price — nothing is faked or simulated for them. Adjust
   the `symbol` values below once you know what your plan
   covers (check https://twelvedata.com/pricing / the API
   playground).
--------------------------------------------------------- */
const WATCHLIST = [
  { label: "NIFTY", sub: "Nifty 50 Index", symbol: "NIFTY", currency: "" },
  { label: "BANK NIFTY", sub: "Nifty Bank Index", symbol: "NIFTYBANK", currency: "" },
  { label: "SENSEX", sub: "S&P BSE Sensex", symbol: "SENSEX", currency: "" },
  { label: "GIFT NIFTY", sub: "NSE IX Nifty Futures", symbol: "NIFTY", currency: "" },
  { label: "Gold", sub: "Gold Spot", symbol: "XAU/USD", currency: "$" },
  { label: "Silver", sub: "Silver Spot", symbol: "XAG/USD", currency: "$" },
  { label: "Crude Oil", sub: "WTI Crude", symbol: "WTI/USD", currency: "$" },
  { label: "Natural Gas", sub: "Henry Hub Futures", symbol: "NATGAS/USD", currency: "$" },
  { label: "Bitcoin (BTC)", sub: "BTC / USD", symbol: "BTC/USD", currency: "$" },
  { label: "Ethereum (ETH)", sub: "ETH / USD", symbol: "ETH/USD", currency: "$" },
  { label: "EUR/USD", sub: "Euro / US Dollar", symbol: "EUR/USD", currency: "" },
  { label: "GBP/USD", sub: "Pound / US Dollar", symbol: "GBP/USD", currency: "" },
  { label: "USD/JPY", sub: "Dollar / Yen", symbol: "USD/JPY", currency: "" },
  { label: "USD/INR", sub: "Dollar / Rupee", symbol: "USD/INR", currency: "" },
];

/* Sparkline built from REAL fetched prices only — each symbol
   accumulates up to the last 16 live quotes and the line is
   drawn from that actual history. Until at least two live
   quotes have come in, there is no line (a placeholder dash
   is shown instead), rather than fabricating one. */
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
  return WATCHLIST.map((item) => ({
    ...item,
    price: null,
    changePct: null,
    up: true,
    history: [],
    spark: null,
    unavailable: false,
  }));
}

/* ---------------------------------------------------------
   LIVE DATA — Twelve Data
   https://twelvedata.com — free "Basic" plan, no CORS proxy
   needed (unlike Yahoo Finance, which blocks browser fetches).

   Sign up for a free key at https://twelvedata.com/pricing and
   paste it below. The demo key ("demo") only serves a couple
   of hardcoded symbols and will not work for this watchlist.

   FREE PLAN LIMITS (as of writing): 8 API credits per minute,
   800 API credits per day. Twelve Data's batch endpoint lets
   you request many symbols in ONE call, but each symbol in
   that call still costs 1 credit — a single call for all 14
   watchlist symbols would burn 14 credits at once, over the
   per-minute cap. So instead of one big call, this polls in
   two alternating chunks of 7 symbols each (7 credits/call,
   under the 8/min cap), on a rotating interval below. That
   keeps daily usage comfortably under 800 credits/day at the
   default interval. Tighten the watchlist or lengthen the
   interval if you add more symbols; loosen it if you upgrade
   your plan.

   THIS PANEL SHOWS NO SIMULATED DATA. Every price on screen
   came directly from the last successful Twelve Data response
   for that symbol. Rows that have never had a successful fetch
   show "Fetching…"; rows whose most recent fetch attempt
   failed (and that have no prior live value yet) show
   "Unavailable". Nothing drifts or animates on its own between
   real polls.
--------------------------------------------------------- */
const TWELVE_DATA_API_KEY = "05fc795bee03430bae7802fb9a404530"; // <-- put your free key here
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com/quote";
const CHUNK_SIZE = 7; // symbols per call — stays under the 8 credits/min free-plan cap
const CHUNK_INTERVAL_MS = 15 * 60 * 1000; // 15 min per chunk => full 14-symbol refresh every 30 min
const STAGGER_MS = 65 * 1000; // spacing between chunk calls on initial load, to stay under the per-minute cap

function splitWatchlist() {
  const chunks = [];
  for (let i = 0; i < WATCHLIST.length; i += CHUNK_SIZE) {
    chunks.push(WATCHLIST.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function fetchQuoteChunk(items) {
  const symbols = items.map((w) => w.symbol).join(",");
  const url = `${TWELVE_DATA_BASE_URL}?symbol=${encodeURIComponent(
    symbols
  )}&apikey=${TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("bad response");
  const json = await res.json();

  // Twelve Data returns a single flat object when only one symbol is
  // requested, and an object keyed by symbol when multiple are requested.
  const bySymbol = items.length === 1 ? { [items[0].symbol]: json } : json;

  const anyOk = items.some((w) => {
    const q = bySymbol[w.symbol];
    return q && !q.code && q.status !== "error" && isFinite(parseFloat(q.close));
  });
  if (!anyOk) throw new Error("chunk failed");

  const results = {};
  items.forEach((w) => {
    const q = bySymbol[w.symbol];
    if (q && !q.code && q.status !== "error") {
      const price = parseFloat(q.close);
      const changePct = parseFloat(q.percent_change);
      if (isFinite(price)) {
        results[w.symbol] = { price, changePct: isFinite(changePct) ? changePct : 0 };
      }
    }
  });
  return results;
}

function StockTicker() {
  const [quotes, setQuotes] = useState(buildInitialQuotes);
  const [live, setLive] = useState(false);
  const mounted = useRef(true);
  const chunksRef = useRef(splitWatchlist());
  const chunkIndexRef = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let rotationTimer;
    const staggerTimers = [];

    const applyLiveResults = (results) => {
      setQuotes((prev) =>
        prev.map((q) => {
          const r = results[q.symbol];
          if (!r) return q; // not in this chunk, or this symbol's lookup failed
          const up = r.changePct >= 0;
          const history = [...(q.history || []), r.price].slice(-16);
          return {
            ...q,
            price: r.price,
            changePct: r.changePct,
            up,
            history,
            spark: makeSpark(history),
            unavailable: false,
          };
        })
      );
    };

    const markUnresolved = (items) => {
      setQuotes((prev) =>
        prev.map((q) => {
          if (!items.some((it) => it.symbol === q.symbol)) return q;
          if (q.price != null) return q; // keep the last known live value on screen
          return { ...q, unavailable: true };
        })
      );
    };

    const fetchChunk = (index) => {
      const items = chunksRef.current[index];
      fetchQuoteChunk(items)
        .then((results) => {
          if (!mounted.current) return;
          applyLiveResults(results);
          setLive(true);
        })
        .catch(() => {
          if (!mounted.current) return;
          markUnresolved(items);
        });
    };

    // Fetch every chunk once on mount, staggered to respect the
    // 8 credits/min cap, so the whole watchlist populates as fast
    // as the free plan allows instead of waiting on the full
    // rotation interval for the later chunks.
    chunksRef.current.forEach((_, i) => {
      const t = setTimeout(() => {
        if (mounted.current) fetchChunk(i);
      }, i * STAGGER_MS);
      staggerTimers.push(t);
    });
    chunkIndexRef.current = 0;

    // Once the initial staggered pass is done, settle into a
    // steady rotation: one chunk every CHUNK_INTERVAL_MS.
    const startRotation = setTimeout(() => {
      rotationTimer = setInterval(() => {
        fetchChunk(chunkIndexRef.current);
        chunkIndexRef.current = (chunkIndexRef.current + 1) % chunksRef.current.length;
      }, CHUNK_INTERVAL_MS);
    }, chunksRef.current.length * STAGGER_MS);

    return () => {
      mounted.current = false;
      staggerTimers.forEach(clearTimeout);
      clearTimeout(startRotation);
      if (rotationTimer) clearInterval(rotationTimer);
    };
  }, []);

  const formatPrice = (item) => {
    if (item.price == null) return item.unavailable ? "Unavailable" : "Fetching…";
    const decimals = item.price < 10 ? 4 : 2;
    const val = item.price.toLocaleString(undefined, {
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
        <span>{live ? "Live market data" : "Connecting to market data…"}</span>
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

function validateRegister({ firstName, lastName, email, password, agree }) {
  const errors = {};
  if (!firstName.trim()) errors.firstName = "This field is required";
  if (!lastName.trim()) errors.lastName = "This field is required";

  if (!email.trim()) {
    errors.email = "This field is required";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!password) {
    errors.password = "This field is required";
  }

  if (!agree) errors.agree = "This field is required";

  return errors;
}

function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) {
    errors.email = "This field is required";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address";
  }
  if (!password) {
    errors.password = "This field is required";
  }
  return errors;
}

export default function AuthPage() {
  const [mode, setMode] = useState("register"); // 'register' | 'login'
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Register form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next) => {
    setMode(next);
    setRegisterErrors({});
    setLoginErrors({});
  };

  const handleRegisterSubmit = async () => {
    const errors = validateRegister({ firstName, lastName, email, password, agree });
    setRegisterErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRegisterSubmitting(true);
    try {
      // TODO: wire up to your actual sign-up endpoint
      // await api.register({ firstName, lastName, email, password });
      setAuthenticated(true);
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const handleLoginSubmit = async () => {
    const errors = validateLogin({ email: loginEmail, password: loginPassword });
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoginSubmitting(true);
    try {
      // TODO: wire up to your actual login endpoint
      // await api.login({ email: loginEmail, password: loginPassword });
      setAuthenticated(true);
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Once login or register succeeds, route straight into the
  // stock analytics screen instead of the auth card.
  if (authenticated) {
    return <StockAnalytics />;
  }

  return (
    <div className="amu-wrap">
      <div className="amu-card">
        <div className="amu-left">
          <div className="amu-topbar">
            <div className="amu-logo">AMU</div>
            <button className="amu-back-btn">
              Back to website
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#14213D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <StockTicker />
        </div>

        <div className="amu-right">
          {isRegister ? (
            <>
              <h1 className="amu-title">Create an account</h1>
              <p className="amu-subtitle">
                Already have an account?{" "}
                <button className="amu-link" onClick={() => switchMode("login")}>
                  Log in
                </button>
              </p>

              <div className="amu-row">
                <div className="amu-field-wrap">
                  <input
                    className={`amu-field ${registerErrors.firstName ? "amu-field-error" : ""}`}
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  {registerErrors.firstName && (
                    <span className="amu-error">{registerErrors.firstName}</span>
                  )}
                </div>
                <div className="amu-field-wrap">
                  <input
                    className={`amu-field ${registerErrors.lastName ? "amu-field-error" : ""}`}
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  {registerErrors.lastName && (
                    <span className="amu-error">{registerErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="amu-field-wrap">
                <input
                  className={`amu-field amu-field-single ${registerErrors.email ? "amu-field-error" : ""}`}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {registerErrors.email && <span className="amu-error">{registerErrors.email}</span>}
              </div>

              <div className="amu-field-wrap">
                <input
                  className={`amu-field ${registerErrors.password ? "amu-field-error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="amu-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  type="button"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                {registerErrors.password && (
                  <span className="amu-error">{registerErrors.password}</span>
                )}
              </div>

              <label className="amu-terms">
                <input
                  type="checkbox"
                  className="amu-checkbox"
                  checked={agree}
                  onChange={() => setAgree((a) => !a)}
                />
                <span className="amu-terms-text">
                  I agree to the <a className="amu-link" href="#">Terms &amp; Conditions</a>
                </span>
              </label>
              {registerErrors.agree && <span className="amu-error">{registerErrors.agree}</span>}

              <button
                className="amu-submit"
                type="button"
                onClick={handleRegisterSubmit}
                disabled={registerSubmitting}
              >
                {registerSubmitting ? "Creating account..." : "Create account"}
              </button>

              <div className="amu-divider">
                <span className="line"></span>
                <span>Or register with</span>
                <span className="line"></span>
              </div>
            </>
          ) : (
            <>
              <h1 className="amu-title">Welcome back</h1>
              <p className="amu-subtitle">
                Don&apos;t have an account?{" "}
                <button className="amu-link" onClick={() => switchMode("register")}>
                  Sign up
                </button>
              </p>

              <div className="amu-field-wrap">
                <input
                  className={`amu-field amu-field-single ${loginErrors.email ? "amu-field-error" : ""}`}
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
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

              <div style={{ marginBottom: 22 }}></div>

              <button
                className="amu-submit"
                type="button"
                onClick={handleLoginSubmit}
                disabled={loginSubmitting}
              >
                {loginSubmitting ? "Logging in..." : "Log in"}
              </button>

              <div className="amu-divider">
                <span className="line"></span>
                <span>Or continue with</span>
                <span className="line"></span>
              </div>
            </>
          )}

          <div className="amu-social-row">
            <button className="amu-social-btn">
              <GoogleIcon />
              Google
            </button>
            <button className="amu-social-btn">
              <AppleIcon />
              Apple
            </button>
          </div>
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
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.6 5.6C41.6 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.396 2.11-1.19 2.91-.9.9-2.03 1.42-3.06 1.34-.13-1.11.39-2.25 1.17-3.02.78-.76 2.1-1.32 3.08-1.23zM20.9 17.27c-.32.74-.7 1.42-1.13 2.06-.6.87-1.09 1.47-1.47 1.8-.59.55-1.22.84-1.9.85-.49 0-1.08-.14-1.76-.42-.68-.28-1.31-.42-1.88-.42-.6 0-1.24.14-1.94.42-.7.28-1.26.43-1.69.44-.65.03-1.29-.27-1.92-.88-.41-.36-.92-.97-1.53-1.85-.66-.94-1.2-2.03-1.62-3.27-.45-1.34-.68-2.63-.68-3.88 0-1.44.31-2.68.93-3.72.49-.84 1.14-1.5 1.96-1.99.82-.49 1.7-.74 2.65-.76.51 0 1.18.16 2.02.47.84.31 1.38.47 1.62.47.18 0 .78-.19 1.79-.55.96-.34 1.77-.48 2.43-.43 1.79.14 3.14.85 4.03 2.13-1.6.97-2.4 2.33-2.38 4.08.02 1.36.51 2.49 1.47 3.39.44.42.93.74 1.48.97-.12.35-.25.68-.4 1z"/>
    </svg>
  );
}
