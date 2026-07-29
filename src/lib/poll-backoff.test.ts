import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clampPollRetryAfterMs,
  computePollDelayMs,
  pollWithBackoff,
  POLL_INTERVAL_CAP_MS,
  POLL_RETRY_AFTER_MAX_MS,
  POLL_RETRY_AFTER_MIN_MS,
  shouldResetPollBackoff,
} from "./poll-backoff.js";

describe("computePollDelayMs", () => {
  it("progresses backoff 1s → 2s → 3s → 5s with default base", () => {
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 0,
        jitter: false,
      }),
    ).toBe(1000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 1,
        jitter: false,
      }),
    ).toBe(2000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 2,
        jitter: false,
      }),
    ).toBe(3000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 3,
        jitter: false,
      }),
    ).toBe(5000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 9,
        jitter: false,
      }),
    ).toBe(POLL_INTERVAL_CAP_MS);
  });

  it("caps delay at 5s even when base * multiplier exceeds cap", () => {
    expect(
      computePollDelayMs({
        baseIntervalMs: 2000,
        attemptIndex: 3,
        jitter: false,
      }),
    ).toBe(POLL_INTERVAL_CAP_MS);
  });

  it("applies ±20% jitter bounds when random is injected", () => {
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 0,
        random: () => 0,
      }),
    ).toBe(800);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 0,
        random: () => 1,
      }),
    ).toBe(1200);
  });

  it("honors retry_after_ms within min/max bounds", () => {
    expect(clampPollRetryAfterMs(50)).toBe(POLL_RETRY_AFTER_MIN_MS);
    expect(clampPollRetryAfterMs(60_000)).toBe(POLL_RETRY_AFTER_MAX_MS);
    expect(clampPollRetryAfterMs(30_000)).toBe(30_000);
    expect(POLL_RETRY_AFTER_MAX_MS).toBe(30_000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 0,
        retryAfterMs: 1800,
        jitter: false,
      }),
    ).toBe(1800);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 5,
        retryAfterMs: 25_000,
        jitter: false,
      }),
    ).toBe(25_000);
    expect(
      computePollDelayMs({
        baseIntervalMs: 1000,
        attemptIndex: 5,
        retryAfterMs: 80,
        jitter: false,
      }),
    ).toBe(POLL_RETRY_AFTER_MIN_MS);
  });
});

describe("shouldResetPollBackoff", () => {
  it("resets on status or progress identifier change", () => {
    expect(
      shouldResetPollBackoff(
        { status: "queued", progressId: "build-1" },
        { status: "active", progressId: "build-1" },
      ),
    ).toBe(true);
    expect(
      shouldResetPollBackoff(
        { status: "running", progressId: "undeploy" },
        { status: "running", progressId: "wait_undeploy" },
      ),
    ).toBe(true);
    expect(
      shouldResetPollBackoff(
        { status: "active", progressId: "build-1" },
        { status: "active", progressId: "build-1" },
      ),
    ).toBe(false);
    expect(shouldResetPollBackoff(null, { status: "queued" })).toBe(false);
  });
});

describe("pollWithBackoff", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets backoff when observed status changes", async () => {
    const sleeps: number[] = [];
    const statuses = ["queued", "active", "active", "completed"] as const;
    let pollIndex = 0;

    const result = await pollWithBackoff({
      poll: async () => {
        const status = statuses[Math.min(pollIndex, statuses.length - 1)]!;
        pollIndex += 1;
        return { status, build_id: "build-1" };
      },
      isTerminal: (job) => job.status === "completed",
      getProgress: (job) => ({
        status: job.status,
        progressId: job.build_id,
      }),
      baseIntervalMs: 1000,
      timeoutMs: 60_000,
      timeoutMessage: "timeout",
      runtime: {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        now: () => 0,
        random: () => 0.5,
      },
    });

    expect(result.status).toBe("completed");
    expect(sleeps).toEqual([1000, 1000, 2000]);
  });

  it("issues fewer polls than a fixed 1s interval over the same timeout window", async () => {
    vi.useFakeTimers();

    let pollCount = 0;
    const promise = pollWithBackoff({
      poll: async () => {
        pollCount += 1;
        return { status: "active", build_id: "build-1" };
      },
      isTerminal: () => false,
      getProgress: (job) => ({
        status: job.status,
        progressId: job.build_id,
      }),
      baseIntervalMs: 1000,
      timeoutMs: 5_000,
      timeoutMessage: "timed out",
      runtime: {
        sleep: (ms) => vi.advanceTimersByTimeAsync(ms),
        now: () => Date.now(),
        random: () => 0.5,
      },
    });

    await expect(promise).rejects.toThrow("timed out");
    expect(pollCount).toBe(3);
    expect(pollCount).toBeLessThan(5);
  });
});
