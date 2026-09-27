/**
 * Date utility functions for Aarambh TradeX
 */

/**
 * Computes conditional default starting date:
 * - If today's stock data has been fetched (6:00 PM or later), use today's date (if weekday, or previous Friday if weekend).
 * - If today's data has not yet been fetched (before 6:00 PM), default to previous working day's date.
 *
 * @param {Date} [refDate=new Date()]
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getConditionalActionDate(refDate = new Date()) {
  const d = new Date(refDate);
  const hours = d.getHours();

  // If 6:00 PM (18:00) or later, today's data is considered fetched
  const isDataFetched = hours >= 18;

  const target = new Date(d);
  if (!isDataFetched) {
    // If before 6 PM, subtract 1 day first
    target.setDate(target.getDate() - 1);
  }

  // Adjust for weekend (Saturday / Sunday -> Friday)
  const dayOfWeek = target.getDay(); // 0 = Sun, 6 = Sat
  if (dayOfWeek === 0) {
    // Sunday -> Friday (-2 days)
    target.setDate(target.getDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday (-1 day)
    target.setDate(target.getDate() - 1);
  }

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format raw date into readable DD-MM-YYYY format
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(dateStr);
  }
}
