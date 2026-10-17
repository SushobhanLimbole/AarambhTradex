/**
 * Centralized API Client for HTTP requests with robust timeout & 504 handling
 */
export async function apiClient(url, options = {}) {
  const token = localStorage.getItem("token");
  const maxRetries = options.retries !== undefined ? options.retries : (options.method && options.method !== "GET" ? 0 : 1);
  const timeoutMs = options.timeoutMs || 28000; // 28s client safety timeout before 30s gateway timeout

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: "omit",
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  // Handle client-side timeout and optional caller signal
  let timeoutId = null;
  let effectiveSignal = options.signal;

  if (!effectiveSignal && typeof AbortController !== "undefined") {
    const controller = new AbortController();
    effectiveSignal = controller.signal;
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Client request timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  }

  if (effectiveSignal) {
    config.signal = effectiveSignal;
  }

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, config);
      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Special friendly handling for Gateway Timeout (504)
        if (response.status === 504) {
          // Retry once on GET requests if retries remaining
          if (attempt < maxRetries && (!options.method || options.method === "GET")) {
            attempt++;
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          const errorMsg =
            data.message ||
            "Gateway Timeout (504): The server is processing large market records and took longer than expected. Please retry.";
          const error = new Error(errorMsg);
          error.status = 504;
          error.isTimeout = true;
          error.data = data;
          throw error;
        }

        // 502 / 503 Bad Gateway / Service Unavailable
        if (response.status === 502 || response.status === 503) {
          if (attempt < maxRetries && (!options.method || options.method === "GET")) {
            attempt++;
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          const errorMsg = data.message || `Server temporarily unavailable (${response.status}). Please retry in a few moments.`;
          const error = new Error(errorMsg);
          error.status = response.status;
          error.data = data;
          throw error;
        }

        const errorMsg = data.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // If aborted due to client timeout
      if (err.name === "AbortError" && !options.signal?.aborted) {
        const timeoutError = new Error("Gateway Timeout (504): Request timed out waiting for server response. Please retry.");
        timeoutError.status = 504;
        timeoutError.isTimeout = true;
        throw timeoutError;
      }

      // If already handled error with status, rethrow
      if (err.status) throw err;

      // Handle network drop
      if (attempt < maxRetries && (!options.method || options.method === "GET")) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      throw err;
    }
  }
}

export default apiClient;
