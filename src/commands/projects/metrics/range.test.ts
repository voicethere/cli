import { describe, expect, it } from "vitest";
import {
  METRICS_PERIODS,
  VOICE_METRICS_PERIODS,
  resolveMetricsRange,
} from "./range.js";

describe("resolveMetricsRange", () => {
  it("returns an empty range when nothing is set", () => {
    expect(resolveMetricsRange({})).toEqual({});
  });

  it.each(METRICS_PERIODS)("accepts period %s", (period) => {
    expect(resolveMetricsRange({ period })).toEqual({ period });
  });

  it("rejects an unknown period", () => {
    expect(() => resolveMetricsRange({ period: "90d" })).toThrow(
      /--period must be one of/,
    );
  });

  it("limits voice periods to 1h, 6h, 24h and 7d", () => {
    expect(
      resolveMetricsRange({ period: "7d" }, VOICE_METRICS_PERIODS),
    ).toEqual({ period: "7d" });
    expect(() =>
      resolveMetricsRange({ period: "30d" }, VOICE_METRICS_PERIODS),
    ).toThrow(/--period must be one of: 1h, 6h, 24h, 7d/);
  });

  it("accepts a valid custom window", () => {
    expect(
      resolveMetricsRange({
        start: "2026-10-01T00:00:00Z",
        end: "2026-10-02T00:00:00Z",
      }),
    ).toEqual({ start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z" });
  });

  it("rejects --start without --end and the reverse", () => {
    expect(() =>
      resolveMetricsRange({ start: "2026-10-01T00:00:00Z" }),
    ).toThrow(/together/);
    expect(() => resolveMetricsRange({ end: "2026-10-01T00:00:00Z" })).toThrow(
      /together/,
    );
  });

  it("rejects timestamps that are not ISO 8601", () => {
    expect(() =>
      resolveMetricsRange({ start: "yesterday", end: "2026-10-02T00:00:00Z" }),
    ).toThrow(/--start must be an ISO 8601/);
    expect(() =>
      resolveMetricsRange({ start: "2026-10-01T00:00:00Z", end: "" }),
    ).toThrow(/--end must be an ISO 8601/);
  });

  it("rejects start at or after end", () => {
    expect(() =>
      resolveMetricsRange({
        start: "2026-10-02T00:00:00Z",
        end: "2026-10-01T00:00:00Z",
      }),
    ).toThrow(/before/);
    expect(() =>
      resolveMetricsRange({
        start: "2026-10-01T00:00:00Z",
        end: "2026-10-01T00:00:00Z",
      }),
    ).toThrow(/before/);
  });

  it("rejects --period combined with --start/--end", () => {
    expect(() =>
      resolveMetricsRange({
        period: "24h",
        start: "2026-10-01T00:00:00Z",
        end: "2026-10-02T00:00:00Z",
      }),
    ).toThrow(/not both/);
  });
});
