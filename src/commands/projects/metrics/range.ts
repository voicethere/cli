import type { MetricsRange } from "../../../lib/api.js";

/** Presets accepted by `/metrics`, `/metrics/sessions` and `/metrics/agent`. */
export const METRICS_PERIODS = ["1h", "6h", "24h", "7d", "30d", "mtd"] as const;

/** Presets accepted by `/voice-metrics`. */
export const VOICE_METRICS_PERIODS = ["1h", "6h", "24h", "7d"] as const;

export interface MetricsRangeOptions {
  period?: string;
  start?: string;
  end?: string;
}

/** Parse an ISO 8601 timestamp; throws with the flag name when it is not one. */
export function parseIsoFlag(flag: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`${flag} must be an ISO 8601 timestamp (got "${raw}")`);
  }
  return trimmed;
}

/**
 * Turn `--period` / `--start` / `--end` into the API range.
 * `--period` excludes `--start`/`--end`; `--start` and `--end` come together and start < end.
 */
export function resolveMetricsRange(
  options: MetricsRangeOptions,
  allowedPeriods: readonly string[] = METRICS_PERIODS,
): MetricsRange {
  const hasStart = options.start != null;
  const hasEnd = options.end != null;

  if (options.period != null && (hasStart || hasEnd)) {
    throw new Error("Use either --period or --start/--end, not both");
  }

  if (hasStart || hasEnd) {
    if (!hasStart || !hasEnd) {
      throw new Error("--start and --end must be given together");
    }
    const start = parseIsoFlag("--start", options.start as string);
    const end = parseIsoFlag("--end", options.end as string);
    if (Date.parse(start) >= Date.parse(end)) {
      throw new Error("--start must be before --end");
    }
    return { start, end };
  }

  if (options.period != null) {
    if (!allowedPeriods.includes(options.period)) {
      throw new Error(
        `--period must be one of: ${allowedPeriods.join(", ")} (got "${options.period}")`,
      );
    }
    return { period: options.period };
  }

  return {};
}

/** "24h" for presets, "<start> to <end>" for explicit windows. */
export function describeWindow(response: {
  period: string | null;
  range_start: string | null;
  range_end: string | null;
}): string {
  if (response.period) {
    return response.period;
  }
  return `${response.range_start ?? "?"} to ${response.range_end ?? "?"}`;
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? "-" : String(Math.round(value * 100) / 100);
}

/** Print rows as two aligned columns under a title. */
export function printTable(
  title: string,
  headers: [string, string],
  rows: Array<[string, number]>,
): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  (none)");
    return;
  }
  const width = Math.max(headers[0].length, ...rows.map((r) => r[0].length));
  console.log(`  ${headers[0].padEnd(width)}  ${headers[1]}`);
  for (const [label, count] of rows) {
    console.log(`  ${label.padEnd(width)}  ${count}`);
  }
}
