import { getLiveTickerQuotes } from "../services/angelOne.service.js";

/**
 * Controller to fetch real-time market ticker quotes from Angel One SmartAPI.
 */
export async function getLiveQuotes(req, res) {
  try {
    const data = await getLiveTickerQuotes();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching Angel One live quotes:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch live quotes from Angel One SmartAPI",
    });
  }
}
