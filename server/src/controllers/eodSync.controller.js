import {
  syncIndianEOD,
  syncGlobalEOD,
  reconcileHistoricalData,
} from "../services/eodSync.service.js";
import { getCronStatus, jobState } from "../services/cronScheduler.service.js";

/**
 * Controller for Administrative EOD Synchronization and Cron Status
 */

/**
 * POST /api/sync/indian
 * Trigger manual Indian Market EOD sync (NSE & BSE)
 * Body (optional): { date: "YYYY-MM-DD", limit: number }
 */
export const triggerIndianSync = async (req, res, next) => {
  try {
    const { date, limit } = req.body || {};
    console.log(
      `[EODController] [${new Date().toISOString()}] Manual Indian EOD sync triggered by user.`
    );

    jobState.indian.status = "RUNNING";
    jobState.indian.lastRun = new Date().toISOString();
    jobState.indian.lastError = null;

    // Run async or wait based on limit
    const result = await syncIndianEOD({ date, limit });

    jobState.indian.status = "COMPLETED";
    jobState.indian.recordsUpdated = result.syncedCount || 0;
    jobState.indian.durationMs = result.durationMs || 0;

    return res.status(200).json({
      success: true,
      message: "Indian Market EOD Sync completed successfully",
      data: result,
    });
  } catch (error) {
    jobState.indian.status = "FAILED";
    jobState.indian.lastError = error.message || String(error);
    next(error);
  }
};

/**
 * POST /api/sync/global
 * Trigger manual Global Assets EOD sync (Crypto & Metals)
 * Body (optional): { date: "YYYY-MM-DD" }
 */
export const triggerGlobalSync = async (req, res, next) => {
  try {
    const { date } = req.body || {};
    console.log(
      `[EODController] [${new Date().toISOString()}] Manual Global Assets EOD sync triggered by user.`
    );

    jobState.global.status = "RUNNING";
    jobState.global.lastRun = new Date().toISOString();
    jobState.global.lastError = null;

    const result = await syncGlobalEOD({ date });

    jobState.global.status = "COMPLETED";
    jobState.global.recordsUpdated = result.recordsInserted || result.syncedCount || 0;
    jobState.global.durationMs = result.durationMs || 0;

    return res.status(200).json({
      success: true,
      message: "Global Assets EOD Sync completed successfully",
      data: result,
    });
  } catch (error) {
    jobState.global.status = "FAILED";
    jobState.global.lastError = error.message || String(error);
    next(error);
  }
};

/**
 * POST /api/sync/reconcile
 * Trigger manual 30-day Corporate Actions & Stock Split Reconciliation
 * Body (optional): { days: number, limit: number }
 */
export const triggerReconciliation = async (req, res, next) => {
  try {
    const { days = 30, limit } = req.body || {};
    console.log(
      `[EODController] [${new Date().toISOString()}] Manual 30-day Reconciliation triggered by user.`
    );

    jobState.reconcile.status = "RUNNING";
    jobState.reconcile.lastRun = new Date().toISOString();
    jobState.reconcile.lastError = null;

    const result = await reconcileHistoricalData({ days, limit });

    jobState.reconcile.status = "COMPLETED";
    jobState.reconcile.recordsUpdated = result.reconciledCount || 0;
    jobState.reconcile.durationMs = result.durationMs || 0;

    return res.status(200).json({
      success: true,
      message: "Historical Data Reconciliation completed successfully",
      data: result,
    });
  } catch (error) {
    jobState.reconcile.status = "FAILED";
    jobState.reconcile.lastError = error.message || String(error);
    next(error);
  }
};

/**
 * POST /api/sync/holidays
 * Trigger manual sync of annual holiday calendar (NSE, BSE, Metals, Crypto)
 */
export const triggerHolidaysSync = async (req, res, next) => {
  try {
    console.log(
      `[EODController] [${new Date().toISOString()}] Manual Holiday calendar sync triggered by user.`
    );

    jobState.annualHolidays.status = "RUNNING";
    jobState.annualHolidays.lastRun = new Date().toISOString();
    jobState.annualHolidays.lastError = null;

    const startTime = Date.now();
    const { fetchAndSaveHolidays } = await import("../scripts/holidays.js");
    const { reloadHolidayCache } = await import("../utils/holidayUtils.js");

    const payload = await fetchAndSaveHolidays();
    reloadHolidayCache();

    const totalCount =
      (payload?.NSE?.equities?.length || 0) +
      (payload?.GLOBAL_METALS?.holidays?.length || 0);

    jobState.annualHolidays.status = "COMPLETED";
    jobState.annualHolidays.recordsUpdated = totalCount;
    jobState.annualHolidays.durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: "Annual Holiday Calendar sync completed successfully",
      data: {
        totalEquitiesHolidays: payload?.NSE?.equities?.length || 0,
        totalMetalsHolidays: payload?.GLOBAL_METALS?.holidays?.length || 0,
        durationMs: jobState.annualHolidays.durationMs,
      },
    });
  } catch (error) {
    jobState.annualHolidays.status = "FAILED";
    jobState.annualHolidays.lastError = error.message || String(error);
    next(error);
  }
};

/**
 * GET /api/sync/status
 * Get current running status, last execution timestamps, and error metrics
 */
export const getSyncStatus = async (req, res, next) => {
  try {
    const status = getCronStatus();
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};
