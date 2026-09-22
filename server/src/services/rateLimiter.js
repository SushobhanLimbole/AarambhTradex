/**
 * Rate Limiter & Throttled Queue Execution Utility
 * Protects against HTTP 429 rate limits by applying jittered delays,
 * global cooldowns upon 429 detection, and exponential backoff retry logic.
 */

export class RateLimiter {
  constructor(options = {}) {
    this.minDelayMs = options.minDelayMs || 200;
    this.maxDelayMs = options.maxDelayMs || 350;
    this.maxRetries = options.maxRetries || 3;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.cooldownUntil = 0;
    this.consecutive429Count = 0;
    this.failedQueue = [];
  }

  /**
   * Generates a random jittered delay between minDelayMs and maxDelayMs
   */
  getJitterDelay() {
    return Math.floor(
      this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs)
    );
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for active global cooldown if one is currently in effect
   */
  async awaitCooldownIfActive() {
    const now = Date.now();
    if (this.cooldownUntil > now) {
      const waitTime = this.cooldownUntil - now;
      console.log(
        `[RateLimiter] [${new Date().toISOString()}] Global cooldown active. Pausing requests for ${(waitTime / 1000).toFixed(1)}s...`
      );
      await this.sleep(waitTime);
    }
  }

  /**
   * Trigger a global rate-limit cooldown across all pending executions
   */
  triggerGlobalCooldown(baseCooldownMs = 15000) {
    this.consecutive429Count++;
    // Exponential multiplier based on consecutive 429 encounters (15s -> 30s -> 60s max 120s)
    const multiplier = Math.min(Math.pow(2, this.consecutive429Count - 1), 8);
    const cooldownDuration = Math.min(baseCooldownMs * multiplier, 120000);
    const jitter = Math.floor(Math.random() * 2000);
    this.cooldownUntil = Date.now() + cooldownDuration + jitter;

    console.warn(
      `[RateLimiter] [${new Date().toISOString()}] ⚠️ Rate limit (HTTP 429) detected! Triggered global cooldown for ${(cooldownDuration / 1000).toFixed(1)}s (Consecutive 429s: ${this.consecutive429Count})`
    );
  }

  /**
   * Execute an async task with retry logic and exponential backoff on failure (e.g. HTTP 429)
   * @param {Function} taskFn - () => Promise<any>
   * @param {string} identifier - Symbol name or task ID for logging
   * @returns {Promise<any>}
   */
  async executeWithRetry(taskFn, identifier = "unknown") {
    let attempts = 0;
    let currentBackoff = this.initialBackoffMs;

    while (attempts < this.maxRetries) {
      // Respect any active global cooldown before attempting
      await this.awaitCooldownIfActive();

      try {
        attempts++;
        const result = await taskFn();

        // Successful request resets consecutive 429 counter gradually
        if (this.consecutive429Count > 0) {
          this.consecutive429Count = Math.max(0, this.consecutive429Count - 0.5);
        }

        // Intentional jittered pause before returning to throttle throughput
        await this.sleep(this.getJitterDelay());
        return result;
      } catch (err) {
        const errMsg = err.message ? err.message.toLowerCase() : "";
        const isRateLimited =
          err.status === 429 ||
          err.statusCode === 429 ||
          errMsg.includes("429") ||
          errMsg.includes("too many requests") ||
          errMsg.includes("rate limit");

        const isNetworkError =
          err.code === "ECONNRESET" ||
          err.code === "ETIMEDOUT" ||
          err.code === "ENOTFOUND" ||
          errMsg.includes("fetch failed") ||
          errMsg.includes("econnrefused");

        const isNotFound =
          err.status === 404 ||
          err.statusCode === 404 ||
          errMsg.includes("not found") ||
          errMsg.includes("delisted") ||
          errMsg.includes("no data");

        if (isRateLimited) {
          this.triggerGlobalCooldown(15000);
        }

        const shouldRetry = (isRateLimited || isNetworkError) && attempts < this.maxRetries;

        if (shouldRetry) {
          const jitter = Math.floor(Math.random() * 500);
          const backoffTime = currentBackoff + jitter;
          console.warn(
            `[RateLimiter] [${new Date().toISOString()}] Warning: ${identifier} hit ${
              isRateLimited ? "HTTP 429 (Rate Limited)" : err.message
            }. Retrying attempt ${attempts}/${this.maxRetries} after ${backoffTime}ms...`
          );
          await this.sleep(backoffTime);
          currentBackoff *= 2; // Exponential backoff
        } else {
          // Log into failed queue with categorization
          this.failedQueue.push({
            identifier,
            error: err.message || String(err),
            isRateLimited,
            isNetworkError,
            isNotFound,
            retryable: isRateLimited || isNetworkError,
            attempts,
            timestamp: new Date().toISOString(),
          });
          throw err;
        }
      }
    }
  }

  /**
   * Clear the failed queue
   */
  clearFailedQueue() {
    this.failedQueue = [];
    this.cooldownUntil = 0;
    this.consecutive429Count = 0;
  }

  /**
   * Get all failed items
   */
  getFailedQueue() {
    return [...this.failedQueue];
  }

  /**
   * Get only retryable failed items (rate limits and network errors)
   */
  getRetryableFailedQueue() {
    return this.failedQueue.filter((item) => item.retryable);
  }
}

export const defaultRateLimiter = new RateLimiter({
  minDelayMs: 200,
  maxDelayMs: 350,
  maxRetries: 3,
  initialBackoffMs: 1000,
});

export default defaultRateLimiter;

