/** Fixed backoff between HTTP transport/gateway retries (7 waits + 1 initial attempt). */
export const API_HTTP_RETRY_DELAYS_MS = [
  500, 1000, 2500, 5000, 15000, 30000, 60000,
] as const;

const RETRYABLE_ERRNO_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
]);

function errnoCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  if (err.name === "TypeError") {
    return true;
  }

  const message = err.message.toLowerCase();
  if (message.includes("fetch failed")) {
    return true;
  }

  const cause = err.cause;
  const causeCode = errnoCode(cause);
  if (causeCode && RETRYABLE_ERRNO_CODES.has(causeCode)) {
    return true;
  }

  const causeName = errorName(cause);
  if (causeName?.startsWith("UND_ERR")) {
    return true;
  }

  return false;
}

/** Thrown internally when a gateway status should be retried before surfacing ApiError. */
export class RetryableHttpStatusError extends Error {
  readonly status: number;
  readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`HTTP ${status}`);
    this.name = "RetryableHttpStatusError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

function isRetryableHttpError(err: unknown): boolean {
  return (
    err instanceof RetryableHttpStatusError && isRetryableHttpStatus(err.status)
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withHttpRetries<T>(
  fn: () => Promise<T>,
  options?: {
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (info: {
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      error: unknown;
    }) => void;
  },
): Promise<T> {
  const delays = API_HTTP_RETRY_DELAYS_MS;
  const maxAttempts = delays.length + 1;
  const sleep = options?.sleep ?? defaultSleep;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error: unknown) {
      const retryable =
        isRetryableNetworkError(error) || isRetryableHttpError(error);
      if (!retryable || attempt >= maxAttempts - 1) {
        throw error;
      }

      const delayMs = delays[attempt] ?? delays.at(-1)!;
      options?.onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
        error,
      });
      await sleep(delayMs);
    }
  }

  throw new Error(
    "withHttpRetries: exhausted attempts without return or throw",
  );
}
