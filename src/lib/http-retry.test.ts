import { describe, expect, it, vi } from "vitest";
import {
  API_HTTP_RETRY_DELAYS_MS,
  isRetryableHttpStatus,
  isRetryableNetworkError,
  RetryableHttpStatusError,
  withHttpRetries,
} from "./http-retry.js";

describe("isRetryableHttpStatus", () => {
  it("retries gateway statuses only", () => {
    expect(isRetryableHttpStatus(502)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(504)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(429)).toBe(false);
  });
});

describe("isRetryableNetworkError", () => {
  it("detects TypeError and fetch failed", () => {
    expect(isRetryableNetworkError(new TypeError("Failed to fetch"))).toBe(
      true,
    );
    expect(isRetryableNetworkError(new Error("fetch failed"))).toBe(true);
  });

  it("detects errno codes on error.cause", () => {
    const err = new Error("fetch failed", {
      cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }),
    });
    expect(isRetryableNetworkError(err)).toBe(true);

    const timeout = new Error("fetch failed", {
      cause: { code: "ETIMEDOUT" },
    });
    expect(isRetryableNetworkError(timeout)).toBe(true);
  });

  it("detects undici UND_ERR_* on error.cause", () => {
    const err = new Error("fetch failed", {
      cause: { name: "UND_ERR_CONNECT_TIMEOUT" },
    });
    expect(isRetryableNetworkError(err)).toBe(true);
  });

  it("rejects non-retryable errors", () => {
    expect(isRetryableNetworkError(new Error("bad request"))).toBe(false);
    expect(isRetryableNetworkError("oops")).toBe(false);
  });
});

describe("withHttpRetries", () => {
  it("uses the exact delay schedule", () => {
    expect(API_HTTP_RETRY_DELAYS_MS).toEqual([
      500, 1000, 2500, 5000, 15000, 30000, 60000,
    ]);
  });

  it("succeeds after transient network failures", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue("ok");

    const result = await withHttpRetries(fn, { sleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });

  it("gives up after the final attempt without an extra wait", async () => {
    const sleep = vi.fn(async () => {});
    const networkError = new TypeError("fetch failed");
    const fn = vi.fn().mockRejectedValue(networkError);

    await expect(withHttpRetries(fn, { sleep })).rejects.toBe(networkError);
    expect(fn).toHaveBeenCalledTimes(8);
    expect(sleep).toHaveBeenCalledTimes(7);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([
      ...API_HTTP_RETRY_DELAYS_MS,
    ]);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn(async () => {});
    const appError = new Error("validation failed");
    const fn = vi.fn().mockRejectedValue(appError);

    await expect(withHttpRetries(fn, { sleep })).rejects.toBe(appError);
    expect(fn).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries RetryableHttpStatusError for gateway statuses", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableHttpStatusError(503, "down"))
      .mockResolvedValue("ok");

    const result = await withHttpRetries(fn, { sleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]?.[0]).toBe(500);
  });

  it("invokes onRetry with attempt metadata", async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    const err = new RetryableHttpStatusError(502, "");

    await withHttpRetries(
      vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok"),
      { sleep, onRetry },
    );

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry.mock.calls[0][0]).toEqual({
      attempt: 1,
      maxAttempts: 8,
      delayMs: 500,
      error: err,
    });
  });
});
