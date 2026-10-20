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

/** Errno codes that mean the request never left this machine, so a write is safe to resend. */
const NOT_SENT_ERRNO_CODES = new Set(["ECONNREFUSED", "ENOTFOUND"]);

export function isRetryableHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** GET/HEAD/OPTIONS can be resent; writes cannot (one retry layer, never for writes). */
export function isIdempotentHttpMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === "GET" || upper === "HEAD" || upper === "OPTIONS";
}

/** True when a non-empty body is not JSON (gateway or edge error page, HTML). */
export function isNonJsonBody(text: string): boolean {
  if (text.trim().length === 0) {
    return false;
  }
  try {
    JSON.parse(text);
    return false;
  } catch {
    return true;
  }
}

/**
 * Whether a non-2xx response should be retried by {@link withHttpRetries}.
 * Only idempotent methods retry: on 502/503/504, or on any 5xx whose body is not
 * JSON (an edge or proxy error page such as a Cloudflare 52x, never our API).
 */
export function shouldRetryHttpResponse(
  method: string,
  status: number,
  text: string,
): boolean {
  if (!isIdempotentHttpMethod(method)) {
    return false;
  }
  if (isRetryableHttpStatus(status)) {
    return true;
  }
  return status >= 500 && status <= 599 && isNonJsonBody(text);
}

/** Network failures where the request provably never reached the server. */
export function isRequestNotSentError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const causeCode = errnoCode(err.cause);
  return causeCode !== undefined && NOT_SENT_ERRNO_CODES.has(causeCode);
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
  return err instanceof RetryableHttpStatusError;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withHttpRetries<T>(
  fn: () => Promise<T>,
  options?: {
    /**
     * When false (POST/PUT/PATCH/DELETE), only failures where the request was never
     * sent are retried. HTTP statuses are never retried for writes. Default true.
     */
    idempotent?: boolean;
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
  const idempotent = options?.idempotent ?? true;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error: unknown) {
      const retryable = idempotent
        ? isRetryableNetworkError(error) || isRetryableHttpError(error)
        : isRequestNotSentError(error);
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
