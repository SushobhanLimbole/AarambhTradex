import cron from "node-cron";
import { syncIndianEOD, syncGlobalEOD, reconcileHistoricalData } from "./eodSync.service.js";

const TIMEZONE = "Asia/Kolkata";

/**
 * In-memory execution state tracking for all scheduled and manual sync jobs
 */
export const jobState = {
  indian: {
    name: "Indian Market EOD Sync (NSE & BSE)",
    schedule: "30 17 * * 1-5",
    description: "5:30 PM IST, Monday-Friday",
    status: "IDLE", // 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
    lastRun: null,
    recordsUpdated: 0,
    lastError: null,
    durationMs: 0,
  },
  global: {
    name: "Global Assets EOD Sync (Crypto & Metals)",
    schedule: "35 5 * * *",
    description: "5:35 AM IST Daily (35m post 00:00 UTC Close)",
    status: "IDLE",
    lastRun: null,
    recordsUpdated: 0,
    lastError: null,
    durationMs: 0,
  },
  reconcile: {
    name: "Weekly Corporate Actions & Split Reconciliation",
    schedule: "0 2 * * 6",
    description: "2:00 AM IST Every Saturday",
    status: "IDLE",
    lastRun: null,
    recordsUpdated: 0,
    lastError: null,
    durationMs: 0,
  },
};

let indianTask = null;
let globalTask = null;
let reconcileTask = null;

/**
 * Starts all automated cron jobs
 */
export function startCronJobs() {
  console.log(`[CronScheduler] [${new Date().toISOString()}] Initializing EOD Cron Scheduler (Timezone: ${TIMEZONE})...`);

  // Helper to schedule delayed follow-up recovery (5 mins) if rate-limited
  function scheduleDelayedFollowUp(marketKey, syncFn, delayMs = 300000) {
    console.log(
      `[CronScheduler] [${new Date().toISOString()}] Scheduling follow-up recovery for ${marketKey} in ${(delayMs / 60000).toFixed(0)} minutes...`
    );
    setTimeout(async () => {
      if (jobState[marketKey].status === "RUNNING") return;
      console.log(
        `[CronScheduler] [${new Date().toISOString()}] Executing scheduled follow-up recovery for ${marketKey}...`
      );
      jobState[marketKey].status = "RUNNING";
      try {
        const res = await syncFn();
        jobState[marketKey].status = "COMPLETED";
        jobState[marketKey].recordsUpdated =
          (jobState[marketKey].recordsUpdated || 0) + (res.syncedCount || res.recordsInserted || 0);
        jobState[marketKey].durationMs = res.durationMs || 0;
        jobState[marketKey].lastError =
          res.failedCount > 0 ? `${res.failedCount} items still unrecovered` : null;
        console.log(
          `[CronScheduler] [${new Date().toISOString()}] Follow-up recovery for ${marketKey} completed.`
        );
      } catch (err) {
        jobState[marketKey].status = "FAILED";
        jobState[marketKey].lastError = err.message || String(err);
        console.error(
          `[CronScheduler] [${new Date().toISOString()}] Follow-up recovery for ${marketKey} failed:`,
          err
        );
      }
    }, delayMs);
  }

  // 1. Indian EOD: 5:30 PM IST Mon-Fri
  if (!indianTask) {
    indianTask = cron.schedule(
      jobState.indian.schedule,
      async () => {
        console.log(`[CronScheduler] [${new Date().toISOString()}] Triggering scheduled Indian Market EOD Sync...`);
        jobState.indian.status = "RUNNING";
        jobState.indian.lastRun = new Date().toISOString();
        jobState.indian.lastError = null;

        try {
          const res = await syncIndianEOD();
          jobState.indian.status = "COMPLETED";
          jobState.indian.recordsUpdated = res.syncedCount || 0;
          jobState.indian.durationMs = res.durationMs || 0;
          console.log(`[CronScheduler] [${new Date().toISOString()}] Scheduled Indian EOD Sync Completed successfully.`);

          // If there were any unrecovered failed symbols due to rate limits, schedule a 5-min follow-up
          if (res.failedCount > 0) {
            scheduleDelayedFollowUp("indian", () => syncIndianEOD());
          }
        } catch (err) {
          jobState.indian.status = "FAILED";
          jobState.indian.lastError = err.message || String(err);
          console.error(`[CronScheduler] [${new Date().toISOString()}] Scheduled Indian EOD Sync Failed:`, err);
          scheduleDelayedFollowUp("indian", () => syncIndianEOD());
        }
      },
      { timezone: TIMEZONE }
    );
    console.log(`✓ Indian EOD Cron scheduled: ${jobState.indian.schedule} (${jobState.indian.description})`);
  }

  // 2. Global Assets EOD: 5:35 AM IST Daily
  if (!globalTask) {
    globalTask = cron.schedule(
      jobState.global.schedule,
      async () => {
        console.log(`[CronScheduler] [${new Date().toISOString()}] Triggering scheduled Global Assets EOD Sync...`);
        jobState.global.status = "RUNNING";
        jobState.global.lastRun = new Date().toISOString();
        jobState.global.lastError = null;

        try {
          const res = await syncGlobalEOD();
          jobState.global.status = "COMPLETED";
          jobState.global.recordsUpdated = res.recordsInserted || res.syncedCount || 0;
          jobState.global.durationMs = res.durationMs || 0;
          console.log(`[CronScheduler] [${new Date().toISOString()}] Scheduled Global EOD Sync Completed successfully.`);

          if (res.failedCount > 0) {
            scheduleDelayedFollowUp("global", () => syncGlobalEOD());
          }
        } catch (err) {
          jobState.global.status = "FAILED";
          jobState.global.lastError = err.message || String(err);
          console.error(`[CronScheduler] [${new Date().toISOString()}] Scheduled Global EOD Sync Failed:`, err);
          scheduleDelayedFollowUp("global", () => syncGlobalEOD());
        }
      },
      { timezone: TIMEZONE }
    );
    console.log(`✓ Global Assets EOD Cron scheduled: ${jobState.global.schedule} (${jobState.global.description})`);
  }

  // 3. Weekly Reconciliation: 2:00 AM IST Saturday
  if (!reconcileTask) {
    reconcileTask = cron.schedule(
      jobState.reconcile.schedule,
      async () => {
        console.log(`[CronScheduler] [${new Date().toISOString()}] Triggering scheduled Weekly Corporate Action Reconciliation...`);
        jobState.reconcile.status = "RUNNING";
        jobState.reconcile.lastRun = new Date().toISOString();
        jobState.reconcile.lastError = null;

        try {
          const res = await reconcileHistoricalData({ days: 30 });
          jobState.reconcile.status = "COMPLETED";
          jobState.reconcile.recordsUpdated = res.reconciledCount || 0;
          jobState.reconcile.durationMs = res.durationMs || 0;
          console.log(`[CronScheduler] [${new Date().toISOString()}] Scheduled Weekly Reconciliation Completed successfully.`);

          if (res.failedCount > 0) {
            scheduleDelayedFollowUp("reconcile", () => reconcileHistoricalData({ days: 30 }));
          }
        } catch (err) {
          jobState.reconcile.status = "FAILED";
          jobState.reconcile.lastError = err.message || String(err);
          console.error(`[CronScheduler] [${new Date().toISOString()}] Scheduled Weekly Reconciliation Failed:`, err);
          scheduleDelayedFollowUp("reconcile", () => reconcileHistoricalData({ days: 30 }));
        }
      },
      { timezone: TIMEZONE }
    );
    console.log(`✓ Weekly Reconciliation Cron scheduled: ${jobState.reconcile.schedule} (${jobState.reconcile.description})`);
  }
}

/**
 * Stops all scheduled cron jobs
 */
export function stopCronJobs() {
  if (indianTask) {
    indianTask.stop();
    indianTask = null;
  }
  if (globalTask) {
    globalTask.stop();
    globalTask = null;
  }
  if (reconcileTask) {
    reconcileTask.stop();
    reconcileTask = null;
  }
  console.log(`[CronScheduler] Stopped all cron jobs.`);
}

/**
 * Returns current status of all scheduled jobs
 */
export function getCronStatus() {
  return {
    timezone: TIMEZONE,
    serverTime: new Date().toISOString(),
    jobs: jobState,
  };
}

export default {
  startCronJobs,
  stopCronJobs,
  getCronStatus,
  jobState,
};
