import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import "./StockAnalytics.css";
import stockService from "../../services/stockService.js";
import { stripSymbolSuffix } from "../../utils/symbolUtils.js";
import SearchableSelect from "../Common/SearchableSelect.jsx";

export { stripSymbolSuffix };

export const getPointerInfo = (code) => {
  if (!code || code === "—") return { code: "—", name: "", type: "neutral" };
  const upper = String(code).trim().toUpperCase();
  if (upper === "FALSE") return { code: "FALSE", name: "", type: "neutral" };
  if (upper === "TABLE TENNIS") return { code: "Table Tennis", name: "", type: "blue" };
  if (upper === "TABLE TOP") return { code: "Table Top", name: "", type: "purple" };
  if (upper === "UPWARD ROTATION") return { code: "Upward Rotation", name: "", type: "cyan" };
  if (upper === "RISING JACK") return { code: "Rising Jack", name: "", type: "orange" };
  if (upper === "FALLING DUCK") return { code: "Falling Duck", name: "", type: "amber" };
  return { code, name: code, type: "orange" };
};

// Helper to parse currency string into pure number
const parseNum = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, "")) || 0;
};

// Helper to format float to readable currency string
const formatNum = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return "—";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Helper to format raw date into clean readable display (e.g. 16-Sep-2026)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  } catch {
    return String(dateStr);
  }
};

// Helper to extract day of week (e.g. Mon, Tue, Wed)
const getDayOfWeek = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "—";
  }
};

const getTodayDateStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function StockAnalytics({ onOpenPointer, onOpenStrategy, selectedStockParams, onBackToSymbols }) {
  const todayStr = useMemo(() => getTodayDateStr(), []);

  // Filter States
  const [exchange, setExchange] = useState(selectedStockParams?.exchange || "ALL");
  const [indexVal, setIndexVal] = useState(selectedStockParams?.indice || "ALL");
  const [ticker, setTicker] = useState(selectedStockParams?.symbol || "ALL");
  const [fromDate, setFromDate] = useState(selectedStockParams?.fromDate || todayStr);
  const [toDate, setToDate] = useState(selectedStockParams?.toDate || todayStr);
  const [timeframe, setTimeframe] = useState(selectedStockParams?.timeframe || "Daily");

  // Sync state and automatically fetch data if selectedStockParams prop changes
  useEffect(() => {
    if (selectedStockParams?.symbol) {
      const sym = selectedStockParams.symbol;
      const ex = selectedStockParams.exchange || "ALL";
      const ind = selectedStockParams.indice || "ALL";
      const fDate = selectedStockParams.fromDate || todayStr;
      const tDate = selectedStockParams.toDate || todayStr;
      const tf = selectedStockParams.timeframe || "Daily";

      setTicker(sym);
      setExchange(ex);
      setIndexVal(ind);
      setFromDate(fDate);
      setToDate(tDate);
      setTimeframe(tf);

      const fetchForIncoming = async () => {
        setLoading(true);
        setError("");
        try {
          const cleanSymbol = sym.split(" ")[0].trim();
          const response = await stockService.getStockData(cleanSymbol, tf, {
            startDate: fDate || undefined,
            endDate: tDate || undefined,
            limit: "all",
            order: "DESC",
          });
          if (response?.data && Array.isArray(response.data)) {
            setRawRecords(response.data);
          } else {
            setRawRecords([]);
          }
        } catch (err) {
          console.error("Error loading selected stock data:", err);
          setError(err.message || "Failed to load stock data from server.");
          setRawRecords([]);
        } finally {
          setLoading(false);
        }
      };

      fetchForIncoming();
    }
  }, [selectedStockParams, todayStr]);

  // Metadata loaded from /api/symbols/meta
  const [availableExchanges, setAvailableExchanges] = useState(["NSE", "BSE"]);
  const [availableIndices, setAvailableIndices] = useState([]);

  // Symbols list loaded dynamically based on exchange & index filter
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);

  // Data loading states
  const [rawRecords, setRawRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Column Visibility States
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    symbol: false,
    day: false,
    avg: true,
    range: true,
    status: true,
    pointer: true,
    virgin: true,
    zone: true,
    closure: true,
    floor: true,
    ceiling: true,
  });

  const toggleCol = (key) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Fetch metadata (exchanges and indices) once on mount (cached in stockService)
  useEffect(() => {
    let isCancelled = false;
    async function loadMeta() {
      try {
        const res = await stockService.getSymbolsMeta();
        if (!isCancelled && res?.data) {
          if (Array.isArray(res.data.exchanges) && res.data.exchanges.length > 0) {
            setAvailableExchanges(res.data.exchanges);
          }
          if (Array.isArray(res.data.indices) && res.data.indices.length > 0) {
            setAvailableIndices(res.data.indices);
          }
        }
      } catch (err) {
        console.warn("Failed to load symbols meta from API:", err);
      }
    }
    loadMeta();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Fetch symbols dynamically only when Exchange or Index filter changes
  useEffect(() => {
    let isCancelled = false;
    async function loadSymbolsForFilter() {
      if (exchange === "ALL" && indexVal === "ALL") {
        setAvailableSymbols([]);
        return;
      }
      setSymbolsLoading(true);
      try {
        const res = await stockService.getSymbolsList({
          exchange: exchange !== "ALL" ? exchange : undefined,
          indice: indexVal !== "ALL" ? indexVal : undefined,
          limit: "all",
        });
        if (!isCancelled && res?.data && Array.isArray(res.data)) {
          setAvailableSymbols(res.data);
        }
      } catch (err) {
        console.warn("Failed to load symbols list:", err);
      } finally {
        if (!isCancelled) setSymbolsLoading(false);
      }
    }
    loadSymbolsForFilter();
    return () => {
      isCancelled = true;
    };
  }, [exchange, indexVal]);

  // 3. Fetch stock candle data on demand based on user input
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let response;
      const options = {
        exchange: exchange !== "ALL" ? exchange : undefined,
        indice: indexVal !== "ALL" ? indexVal : undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        limit: "all",
        order: "DESC",
      };

      if (!ticker || ticker === "ALL" || ticker === "ALL_SYMBOLS") {
        // Initial/Today's load when default today date is selected
        if (fromDate === todayStr && toDate === todayStr && exchange === "ALL" && indexVal === "ALL") {
          response = await stockService.getLatestAllStocks(timeframe, fromDate);
          if (!response?.data || response.data.length === 0) {
            response = await stockService.getLatestAllStocks(timeframe);
          }
        } else {
          response = await stockService.getAllStocks(timeframe, options);
        }
      } else {
        const cleanSymbol = ticker.split(" ")[0].trim();
        response = await stockService.getStockData(cleanSymbol, timeframe, {
          startDate: fromDate || undefined,
          endDate: toDate || undefined,
          limit: "all",
          order: "DESC",
        });
      }

      if (response?.data && Array.isArray(response.data)) {
        setRawRecords(response.data);
      } else {
        setRawRecords([]);
      }
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError(err.message || "Failed to load stock data from server.");
      setRawRecords([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, exchange, indexVal, timeframe, fromDate, toDate, todayStr]);

  // Initial load on mount only (if no symbol preselected)
  useEffect(() => {
    if (!selectedStockParams?.symbol) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [copiedTable, setCopiedTable] = useState(false);

  const handleClear = () => {
    const today = getTodayDateStr();
    setExchange("ALL");
    setIndexVal("ALL");
    setTicker("ALL");
    setFromDate(today);
    setToDate(today);
    setTimeframe("Daily");
  };

  const handleCopyTableToExcel = () => {
    if (!processedRows || processedRows.length === 0) return;

    const headers = ["SR.NO"];
    if (visibleCols.symbol) headers.push("SYMBOL");
    if (visibleCols.day) headers.push("DAY");
    headers.push("DATE", "OPEN", "HIGH", "LOW", "CLOSE");
    if (visibleCols.avg) headers.push("AVG");
    if (visibleCols.range) headers.push("RANGE");
    if (visibleCols.status) headers.push("STATUS");
    if (visibleCols.pointer) headers.push("POINTER");
    if (visibleCols.virgin) headers.push("VIRGIN");
    if (visibleCols.zone) headers.push("ZONE");
    if (visibleCols.closure) headers.push("CLOSURE");
    if (visibleCols.floor) headers.push("FLOOR");
    if (visibleCols.ceiling) headers.push("CEILING PRICE");

    const rows = processedRows.map((r) => {
      const line = [r.no];
      if (visibleCols.symbol) line.push(stripSymbolSuffix(r.symbol));
      if (visibleCols.day) line.push(r.day);
      line.push(r.date, r.open, r.high, r.low, r.close);
      if (visibleCols.avg) line.push(r.avg);
      if (visibleCols.range) line.push(r.range);
      if (visibleCols.status) line.push(r.status || "");
      if (visibleCols.pointer) line.push(r.pointer || "");
      if (visibleCols.virgin) line.push(r.virgin || "");
      if (visibleCols.zone) line.push(r.zone || "");
      if (visibleCols.closure) line.push(r.closure || "");
      if (visibleCols.floor) line.push(r.floor === "—" ? "" : r.floor);
      if (visibleCols.ceiling) line.push(r.ceiling === "—" ? "" : r.ceiling);
      return line.join("\t");
    });

    const tsvContent = [headers.join("\t"), ...rows].join("\n");
    navigator.clipboard?.writeText(tsvContent);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  // 3. Compute calculated analytics columns dynamically from raw records
  const processedRows = useMemo(() => {
    if (!rawRecords || rawRecords.length === 0) return [];

    // Group records by symbol to correctly compare with previous candle of the same symbol
    const symbolMap = {};
    rawRecords.forEach((row) => {
      const sym = row.symbol || "UNKNOWN";
      if (!symbolMap[sym]) symbolMap[sym] = [];
      symbolMap[sym].push(row);
    });

    // Ensure records per symbol are sorted chronologically ASC (earliest first, latest at bottom)
    const resultRows = [];
    let globalIndex = 1;

    Object.keys(symbolMap).forEach((sym) => {
      const rowsForSym = symbolMap[sym];
      // Sort ASC by date (oldest to newest)
      rowsForSym.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 1. Calculate HLC Higher / Lower transitions across rowsForSym (chronological ASC)
      const statusMap = new Map(); // idx -> { status: string, statusType: string }
      const isAbTopMap = new Map(); // idx -> boolean
      const isAbBottomMap = new Map(); // idx -> boolean
      const events = []; // Array of { idx, type: 'HLC HIGHER' | 'HLC LOWER' }
      let currentMode = null; // 'HLC HIGHER' | 'HLC LOWER' | null

      for (let i = 1; i < rowsForSym.length; i++) {
        const curr = rowsForSym[i];
        const prev = rowsForSym[i - 1];
        const cHigh = parseNum(curr.high);
        const cLow = parseNum(curr.low);
        const cClose = parseNum(curr.close);
        const pHigh = parseNum(prev.high);
        const pLow = parseNum(prev.low);
        const pClose = parseNum(prev.close);

        // 4-point institutional criteria:
        // HLC HIGHER: High > Prev High & Low > Prev Low & Close > Prev Close & Close > Prev High
        const isHlcHigher = cHigh > pHigh && cLow > pLow && cClose > pClose && cClose > pHigh;
        // HLC LOWER: High < Prev High & Low < Prev Low & Close < Prev Close & Close < Prev Low
        const isHlcLower = cHigh < pHigh && cLow < pLow && cClose < pClose && cClose < pLow;

        if (isHlcHigher) {
          if (currentMode !== "HLC HIGHER") {
            currentMode = "HLC HIGHER";
            events.push({ idx: i, type: "HLC HIGHER" });
            statusMap.set(i, { status: "HLC HIGHER", statusType: "bullish" });
          }
        } else if (isHlcLower) {
          if (currentMode !== "HLC LOWER") {
            currentMode = "HLC LOWER";
            events.push({ idx: i, type: "HLC LOWER" });
            statusMap.set(i, { status: "HLC LOWER", statusType: "bearish" });
          }
        }
      }

      // 2. Identify AB TOP (Highest High strictly between HLC HIGHER & HLC LOWER)
      //    and AB BOTTOM (Lowest Low strictly between HLC LOWER & HLC HIGHER).
      //    ABS TOP/BOTTOM will ONLY get displayed once the opposite HLC transition has formed.
      for (let e = 1; e < events.length; e++) {
        const prevEv = events[e - 1];
        const currEv = events[e];

        if (prevEv.type === "HLC HIGHER" && currEv.type === "HLC LOWER") {
          // Find candle strictly between with maximum High
          if (currEv.idx > prevEv.idx + 1) {
            let bestIdx = -1;
            let maxHigh = -Infinity;
            for (let k = prevEv.idx + 1; k < currEv.idx; k++) {
              const h = parseNum(rowsForSym[k].high);
              if (h >= maxHigh) {
                maxHigh = h;
                bestIdx = k;
              }
            }
            if (bestIdx !== -1) {
              isAbTopMap.set(bestIdx, true);
            }
          }
        } else if (prevEv.type === "HLC LOWER" && currEv.type === "HLC HIGHER") {
          // Find candle strictly between with minimum Low
          if (currEv.idx > prevEv.idx + 1) {
            let bestIdx = -1;
            let minLow = Infinity;
            for (let k = prevEv.idx + 1; k < currEv.idx; k++) {
              const l = parseNum(rowsForSym[k].low);
              if (l <= minLow) {
                minLow = l;
                bestIdx = k;
              }
            }
            if (bestIdx !== -1) {
              isAbBottomMap.set(bestIdx, true);
            }
          }
        }
      }



      // 4. Precompute Monthly Min Low and Monthly Max High for Floor & Ceiling calculation
      const monthGroups = new Map();
      rowsForSym.forEach((r) => {
        const mKey = r.date ? String(r.date).slice(0, 7) : "UNKNOWN"; // YYYY-MM
        const l = parseNum(r.low);
        const h = parseNum(r.high);
        if (!monthGroups.has(mKey)) {
          monthGroups.set(mKey, { minLow: l, maxHigh: h });
        } else {
          const g = monthGroups.get(mKey);
          if (l < g.minLow) g.minLow = l;
          if (h > g.maxHigh) g.maxHigh = h;
        }
      });

      rowsForSym.forEach((row, idx, arr) => {
        const prevRow = idx > 0 ? arr[idx - 1] : null; // Previous candle chronologically

        const openVal = parseNum(row.open);
        const highVal = parseNum(row.high);
        const lowVal = parseNum(row.low);
        const closeVal = parseNum(row.close);

        // Average: (HIGH + LOW + CLOSE) / 3 (OPEN strictly not considered!)
        const avgVal = (highVal + lowVal + closeVal) / 3;
        const rangeVal = Math.max(0, highVal - lowVal);

        // Status from state machine: only HLC HIGHER / HLC LOWER (blank otherwise)
        const stObj = statusMap.get(idx);
        let status = stObj ? stObj.status : "";
        let statusType = stObj ? stObj.statusType : "neutral";
        const isAbTop = !!isAbTopMap.get(idx);
        const isAbBottom = !!isAbBottomMap.get(idx);

        let virgin = "";
        let virginType = "neutral";
        let zone = "";
        let zoneType = "neutral";
        let closure = "";
        let closureType = "neutral";
        let pointer = "—";
        let pointerType = "neutral";

        if (prevRow) {
          const prevHigh = parseNum(prevRow.high);
          const prevLow = parseNum(prevRow.low);
          const prevClose = parseNum(prevRow.close);
          const prevAvg = (prevHigh + prevLow + prevClose) / 3;

          // 1. VIRGIN: (HIGHER = LOW > PREV.DAY AVG) | (LOWER = HIGH < PREV.DAY AVG)
          if (lowVal > prevAvg) {
            virgin = "HIGHER";
            virginType = "higher";
          } else if (highVal < prevAvg) {
            virgin = "LOWER";
            virginType = "lower";
          } else {
            virgin = "";
            virginType = "neutral";
          }

          // 2. ZONE: (GREEN = CLOSE > PREV.DAY CLOSE & PREV.DAY AVG(BOTH)) | (RED = CLOSE < PREV.DAY CLOSE & PREV.DAY AVG(BOTH))
          if (closeVal > prevClose && closeVal > prevAvg) {
            zone = "GREEN";
            zoneType = "green";
          } else if (closeVal < prevClose && closeVal < prevAvg) {
            zone = "RED";
            zoneType = "red";
          } else {
            zone = "";
            zoneType = "neutral";
          }

          // 3. CLOSURE: (HIGH = CLOSE > PREV.DAY HIGH) | (LOW = CLOSE < PREV.DAY LOW)
          if (closeVal > prevHigh) {
            closure = "HIGH";
            closureType = "high";
          } else if (closeVal < prevLow) {
            closure = "LOW";
            closureType = "low";
          } else {
            closure = "";
            closureType = "neutral";
          }
        }

        const evalPointer = (hV, lV, cV) => {
          const rV = Math.max(0, hV - lV);
          const rm14 = cV + rV * 0.146;
          const rm38 = cV + rV * 0.382;
          const rm61 = cV + rV * 0.618;
          const rm100 = cV + rV * 1.0;
          const fm14 = cV - rV * 0.146;
          const fm38 = cV - rV * 0.382;
          const fm61 = cV - rV * 0.618;
          const fm100 = cV - rV * 1.0;

          if (hV > rm61 && hV < rm100 && lV < fm14 && lV > fm38) {
            return { pointer: "Rising Jack", pointerType: "orange" };
          } else if (hV > rm38 && hV < rm61 && lV < fm38 && lV > fm61) {
            return { pointer: "Table Tennis", pointerType: "blue" };
          } else if (hV > rm14 && hV < rm38 && lV < fm61 && lV > fm100) {
            return { pointer: "Table Top", pointerType: "purple" };
          } else if (hV > fm14 && hV < rm14 && lV > fm100 && lV < fm61) {
            return { pointer: "Upward Rotation", pointerType: "cyan" };
          } else if (hV > rm61 && hV < rm100 && lV > fm14 && lV < rm14) {
            return { pointer: "Falling Duck", pointerType: "amber" };
          }
          return { pointer: "FALSE", pointerType: "neutral" };
        };

        let pointerResult = evalPointer(highVal, lowVal, closeVal);
        // If FALSE, adjust high and low by +0.05 to resolve edge boundary
        if (pointerResult.pointer === "FALSE") {
          pointerResult = evalPointer(highVal + 0.05, lowVal + 0.05, closeVal);
        }

        pointer = pointerResult.pointer;
        pointerType = pointerResult.pointerType;

        // Floor & Ceiling Price:
        // Takes monthly timeframe OHLC and on the date where daily low matches the lowest low of that month, shows floor price.
        // On the date where daily high matches highest high of that month, shows ceiling price.
        const mKey = row.date ? String(row.date).slice(0, 7) : "UNKNOWN";
        const mGroup = monthGroups.get(mKey);
        let floorDisplay = "—";
        let ceilingDisplay = "—";
        if (mGroup) {
          if (Math.abs(lowVal - mGroup.minLow) < 0.001) {
            floorDisplay = formatNum(mGroup.minLow);
          }
          if (Math.abs(highVal - mGroup.maxHigh) < 0.001) {
            ceilingDisplay = formatNum(mGroup.maxHigh);
          }
        }

        resultRows.push({
          rawId: row.id,
          no: String(globalIndex++).padStart(2, "0"),
          symbol: row.symbol || "—",
          day: getDayOfWeek(row.date),
          date: formatDateDisplay(row.date),
          rawDate: row.date,
          open: formatNum(openVal),
          high: formatNum(highVal),
          low: formatNum(lowVal),
          close: formatNum(closeVal),
          avg: formatNum(avgVal),
          range: formatNum(rangeVal),
          rawOpen: openVal,
          rawHigh: highVal,
          rawLow: lowVal,
          rawClose: closeVal,
          rawAvg: avgVal,
          rawRange: rangeVal,
          status,
          statusType,
          isAbTop,
          isAbBottom,
          pointer,
          pointerType,
          virgin,
          virginType,
          zone,
          zoneType,
          closure,
          closureType,
          floor: floorDisplay,
          ceiling: ceilingDisplay,
        });
      });
    });

    return resultRows;
  }, [rawRecords]);

  // Table scroll container ref for scrolling to the last row
  const tableScrollRef = useRef(null);

  // Auto-scroll table to the very last row when records load/update
  useEffect(() => {
    if (!loading && processedRows.length > 0 && tableScrollRef.current) {
      const container = tableScrollRef.current;
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [loading, processedRows]);

  // Handle row click / pointer navigation
  const handleOpenRowDetails = (row) => {
    const payload = {
      open: row.rawOpen,
      high: row.rawHigh,
      low: row.rawLow,
      close: row.rawClose,
      range: row.rawRange,
      average: row.rawAvg,
      timeframe,
      symbol: row.symbol,
      script: stripSymbolSuffix(row.symbol),
      date: row.date,
      title: `${stripSymbolSuffix(row.symbol)} (${row.date}) - Strategy Decision Matrix`,
    };

    if (onOpenStrategy) {
      onOpenStrategy(payload);
    } else if (onOpenPointer) {
      onOpenPointer(payload);
    }
  };

  const exchangeOptions = useMemo(() => [
    { value: "ALL", label: "ALL (All Exchanges)" },
    ...availableExchanges.map((ex) => ({ value: ex, label: ex })),
  ], [availableExchanges]);

  const indexOptions = useMemo(() => [
    { value: "ALL", label: "ALL" },
    ...availableIndices.map((idx) => ({ value: idx, label: idx })),
  ], [availableIndices]);

  const tickerOptions = useMemo(() => {
    const opts = [
      {
        value: "ALL",
        label:
          symbolsLoading
            ? "Loading symbols..."
            : "ALL"
      },
    ];

    if (
      ticker &&
      ticker !== "ALL" &&
      !availableSymbols.some((i) => (typeof i === "string" ? i : i.symbol) === ticker)
    ) {
      opts.push({
        value: ticker,
        label: stripSymbolSuffix(ticker),
      });
    }

    availableSymbols.forEach((item) => {
      const sym = typeof item === "string" ? item : item.symbol;
      const cleanSym = stripSymbolSuffix(sym);
      opts.push({
        value: sym,
        label: cleanSym,
      });
    });

    return opts;
  }, [availableSymbols, symbolsLoading, exchange, indexVal, ticker]);

  const timeframeOptions = useMemo(() => [
    { value: "Daily", label: "Daily" },
    { value: "Weekly", label: "Weekly" },
    { value: "Monthly", label: "Monthly" },
    { value: "Quarterly", label: "Quarterly" },
    { value: "Half-Yearly", label: "Half Yearly" },
    { value: "Yearly", label: "Yearly" },
    { value: "5-Yearly", label: "5 Yearly" },
  ], []);

  const isAllSymbols = !ticker || ticker === "ALL" || ticker === "ALL_SYMBOLS";

  return (
    <div className="analytics-container">
      {/* TOP FILTER TOOLBAR */}
      <div className="filter-toolbar">
        {/* EXCHANGE */}
        <div className="filter-group">
          <label className="filter-label">Exchange</label>
          <SearchableSelect
            options={exchangeOptions}
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
          />
        </div>

        {/* INDEX */}
        <div className="filter-group">
          <label className="filter-label">Index</label>
          <SearchableSelect
            options={indexOptions}
            value={indexVal}
            onChange={(e) => setIndexVal(e.target.value)}
          />
        </div>

        {/* TICKER SYMBOL */}
        <div className="filter-group wide">
          <label className="filter-label">
            Ticker Symbol <span>({symbolsLoading ? "Loading..." : `${availableSymbols.length} Available`})</span>
          </label>
          <SearchableSelect
            options={tickerOptions}
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            disabled={symbolsLoading}
            searchPlaceholder="Type to search ticker symbol..."
          />
        </div>

        {/* FROM DATE */}
        <div className="filter-group">
          <label className="filter-label">From Date</label>
          <input
            type="date"
            className="apple-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* TO DATE */}
        <div className="filter-group">
          <label className="filter-label">To Date</label>
          <input
            type="date"
            className="apple-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* TIMEFRAME */}
        <div className="filter-group">
          <label className="filter-label">Timeframe</label>
          <SearchableSelect
            options={timeframeOptions}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          />
        </div>

        {/* ACTIONS */}
        <div className="filter-actions" style={{ position: "relative" }}>
          <button
            className="btn-analyze"
            onClick={fetchData}
            disabled={loading}
            type="button"
          >
            <span>{loading ? "⏳" : "🔍"}</span> {loading ? "Loading..." : "Analyze"}
          </button>

          <button className="btn-clear" onClick={handleClear} type="button">
            ✕ Clear
          </button>

          <button
            className="btn-columns"
            onClick={() => setShowColumnsMenu((s) => !s)}
            type="button"
          >
            <span>田</span> Columns
          </button>

          <button
            className="btn-copy-excel"
            onClick={handleCopyTableToExcel}
            disabled={loading || processedRows.length === 0}
            type="button"
            title="Copy current table data to paste directly into Excel or Google Sheets"
          >
            <span>{copiedTable ? "✓" : "📋"}</span> {copiedTable ? "Copied!" : "Copy Table"}
          </button>

          {/* COLUMN VISIBILITY POPOVER */}
          {showColumnsMenu && (
            <div className="columns-menu">
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                Add / Remove Columns
              </span>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.symbol}
                  onChange={() => toggleCol("symbol")}
                />
                Symbol
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.day}
                  onChange={() => toggleCol("day")}
                />
                Day
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.avg}
                  onChange={() => toggleCol("avg")}
                />
                AVG
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.range}
                  onChange={() => toggleCol("range")}
                />
                RANGE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.status}
                  onChange={() => toggleCol("status")}
                />
                STATUS
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.pointer}
                  onChange={() => toggleCol("pointer")}
                />
                POINTER
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.virgin}
                  onChange={() => toggleCol("virgin")}
                />
                VIRGIN
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.zone}
                  onChange={() => toggleCol("zone")}
                />
                ZONE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.closure}
                  onChange={() => toggleCol("closure")}
                />
                CLOSURE
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.floor}
                  onChange={() => toggleCol("floor")}
                />
                FLOOR
              </label>
              <label className="col-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleCols.ceiling}
                  onChange={() => toggleCol("ceiling")}
                />
                CEILING PRICE
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          borderRadius: 12,
          padding: "12px 18px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={fetchData}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* MATRIX TABLE CARD */}
      <div className="matrix-card">
        <div className="table-scroll" ref={tableScrollRef}>
          <table className="apple-table">
            <thead>
              <tr>
                <th>SR.NO</th>
                {visibleCols.symbol && <th>SYMBOL</th>}
                {visibleCols.day && <th>DAY</th>}
                <th>DATE</th>
                <th>OPEN</th>
                <th>HIGH</th>
                <th>LOW</th>
                <th>CLOSE</th>
                {visibleCols.avg && <th>AVG</th>}
                {visibleCols.range && <th>RANGE</th>}
                {visibleCols.status && <th>STATUS</th>}
                {visibleCols.pointer && <th>POINTER</th>}
                {visibleCols.virgin && <th title="VIRGIN: HIGHER = Low > Prev.Day Avg | LOWER = High < Prev.Day Avg">VIRGIN</th>}
                {visibleCols.zone && <th title="ZONE: GREEN = Close > Prev.Close & Prev.Avg | RED = Close < Prev.Close & Prev.Avg">ZONE</th>}
                {visibleCols.closure && <th title="CLOSURE: HIGH = Close > Prev.High | LOW = Close < Prev.Low">CLOSURE</th>}
                {visibleCols.floor && <th title="FLOOR: Prev. Period Low">FLOOR</th>}
                {visibleCols.ceiling && <th title="CEILING PRICE: Prev. Period High">CEILING PRICE</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>⏳</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Connecting to MySQL &amp; Loading All Stock Records...</span>
                    </div>
                  </td>
                </tr>
              ) : processedRows.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 32 }}>📊</span>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "#475569" }}>No stock data found for the selected criteria.</span>
                      <span style={{ fontSize: 13 }}>Try selecting "ALL", picking a different timeframe, or adjusting date filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                processedRows.map((row) => {
                  const pInfo = getPointerInfo(row.pointer);
                  return (
                    <tr key={`${row.symbol}-${row.rawId || row.rawDate || row.no}`}>
                      <td className="serial-col">{row.no}</td>
                      {visibleCols.symbol && (
                        <td style={{ fontWeight: 600, color: "#1e293b" }}>
                          {stripSymbolSuffix(row.symbol)}
                        </td>
                      )}
                      {visibleCols.day && <td>{row.day}</td>}
                      <td>{row.date}</td>
                      <td>{row.open}</td>
                      <td className="high-green">
                        {row.isAbTop ? (
                          <span className="val-box ab-top-box" title="ABS TOP: Highest High in cycle">
                            {row.high}
                          </span>
                        ) : (
                          row.high
                        )}
                      </td>
                      <td className={row.statusType === "bearish" ? "low-red" : ""}>
                        {row.isAbBottom ? (
                          <span className="val-box ab-bottom-box" title="ABS BOTTOM: Lowest Low in cycle">
                            {row.low}
                          </span>
                        ) : (
                          row.low
                        )}
                      </td>
                      <td>{row.close}</td>
                      {visibleCols.avg && <td>{row.avg}</td>}
                      {visibleCols.range && <td>{row.range}</td>}
                      {visibleCols.status && (
                        <td>
                          {row.status === "HLC HIGHER" || row.status === "HLC LOWER" ? (
                            <span className={`hlc-badge ${row.statusType}`}>
                              {row.status}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {visibleCols.pointer && (
                        <td>
                          <span
                            className={`pointer-tag ${pInfo.type || row.pointerType || "orange"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleOpenRowDetails(row)}
                            title={`Click to view Strategy Decision Matrix (${pInfo.name || row.pointer})`}
                          >
                            <span className="pointer-code">{pInfo.code}</span>
                            {pInfo.name && <span className="pointer-name">{pInfo.name}</span>}
                            <span className="pointer-arrow">↗</span>
                          </span>
                        </td>
                      )}
                      {visibleCols.virgin && (
                        <td>
                          {row.virgin ? (
                            <span className={`analytics-pill virgin-${row.virginType}`}>
                              {row.virgin}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {visibleCols.zone && (
                        <td>
                          {row.zone ? (
                            <span className={`analytics-pill zone-${row.zoneType}`}>
                              {row.zone}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {visibleCols.closure && (
                        <td>
                          {row.closure ? (
                            <span className={`analytics-pill closure-${row.closureType}`}>
                              {row.closure}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {visibleCols.floor && (
                        <td className="metric-col floor-val" title={`Floor Price for ${timeframe}`}>
                          {row.floor}
                        </td>
                      )}
                      {visibleCols.ceiling && (
                        <td className="metric-col ceiling-val" title={`Ceiling Price for ${timeframe}`}>
                          {row.ceiling}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
