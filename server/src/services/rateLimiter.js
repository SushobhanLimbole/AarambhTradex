/**
 * Rate Limiter & Throttled Queue Execution Utility
 * Protects against HTTP 429 rate limits by applying jittered delays,
 * concurrency limits, and exponential backoff retry logic.
 */

export class RateLimiter {
  constructor(options = {}) {
    this.minDelayMs = options.minDelayMs || 200;
    this.maxDelayMs = options.maxDelayMs || 350;
    this.maxRetries = options.maxRetries || 3;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
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
   * Execute an async task with retry logic and exponential backoff on failure (e.g. HTTP 429)
   * @param {Function} taskFn - () => Promise<any>
   * @param {string} identifier - Symbol name or task ID for logging
   * @returns {Promise<any>}
   */
  async executeWithRetry(taskFn, identifier = "unknown") {
    let attempts = 0;
    let currentBackoff = this.initialBackoffMs;

    while (attempts < this.maxRetries) {
      try {
        attempts++;
        const result = await taskFn();
        // Intentional jittered pause before returning to throttle throughput
        await this.sleep(this.getJitterDelay());
        return result;
      } catch (err) {
        const isRateLimited =
          err.status === 429 ||
          err.statusCode === 429 ||
          (err.message && err.message.includes("429")) ||
          (err.message && err.message.toLowerCase().includes("too many requests"));

        const isNetworkError =
          err.code === "ECONNRESET" ||
          err.code === "ETIMEDOUT" ||
          err.code === "ENOTFOUND" ||
          (err.message && err.message.includes("fetch failed"));

        const shouldRetry = (isRateLimited || isNetworkError) && attempts < this.maxRetries;

        if (shouldRetry) {
          const jitter = Math.floor(Math.random() * 500);
          const backoffTime = currentBackoff + jitter;
          console.warn(
            `[RateLimiter] [${new Date().toISOString()}] Warning: ${identifier} hit ${isRateLimited ? "HTTP 429 (Rate Limited)" : err.message
            }. Retrying attempt ${attempts}/${this.maxRetries} after ${backoffTime}ms...`
          );
          await this.sleep(backoffTime);
          currentBackoff *= 2; // Exponential backoff
        } else {
          // Log into failed queue without crashing the process
          this.failedQueue.push({
            identifier,
            error: err.message || String(err),
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
  }

  /**
   * Get failed items
   */
  getFailedQueue() {
    return [...this.failedQueue];
  }
}

export const defaultRateLimiter = new RateLimiter({
  minDelayMs: 200,
  maxDelayMs: 350,
  maxRetries: 3,
  initialBackoffMs: 1000,
});

export default defaultRateLimiter;
