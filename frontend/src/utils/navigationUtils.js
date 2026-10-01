/**
 * Navigation utility to open Stock Analytics in a new tab with proper filters and date highlighting.
 */
export function openStockAnalyticsInNewTab({
  symbol,
  exchange = "NSE",
  indice = "ALL",
  timeframe = "Daily",
  date,
  highlightDate,
  fromDate,
  toDate,
}) {
  if (!symbol) return;
  const targetDate = highlightDate || date;

  const formatDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  let endD = new Date();
  if (targetDate) {
    const parsed = new Date(targetDate);
    if (!isNaN(parsed.getTime())) {
      // If target date is in future of today, expand endD
      if (parsed > endD) {
        endD = parsed;
      }
    }
  }

  const startD = new Date(endD);
  startD.setMonth(startD.getMonth() - 6);

  const effectiveFrom = fromDate || formatDate(startD);
  const effectiveTo = toDate || formatDate(endD);

  const params = new URLSearchParams();
  params.set("tab", "reports");
  params.set("symbol", symbol);
  params.set("exchange", exchange || "ALL");
  params.set("indice", indice || "ALL");
  params.set("timeframe", timeframe || "Daily");
  params.set("fromDate", effectiveFrom);
  params.set("toDate", effectiveTo);
  if (targetDate) {
    params.set("highlightDate", targetDate);
  }

  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}#reports`;
  window.open(url, "_blank");
}
