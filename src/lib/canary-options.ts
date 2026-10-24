import type { CanaryRoutingMode, CanarySettingsInput } from "./api.js";

/** Raw flag values as commander hands them over. */
export interface CanaryFlagInput {
  routing?: string;
  contextField?: string;
  autoAbortRate?: string;
  autoAbortMinSessions?: string;
  /** False only when `--no-auto-abort` was passed. */
  autoAbort?: boolean;
}

export function parseCanaryPods(raw: string | undefined): number {
  const value = Number(raw);
  if (
    raw === undefined ||
    raw.trim() === "" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `--canary-pods must be a whole number of 1 or more (got "${raw}")`,
    );
  }
  return value;
}

export function parseRoutingFlag(raw: string): CanaryRoutingMode {
  if (raw === "round-robin") return "round_robin";
  if (raw === "customer-context") return "customer_context";
  throw new Error(
    `Invalid --routing "${raw}". Use round-robin or customer-context.`,
  );
}

export function parseRatePct(flag: string, raw: string): number {
  const value = Number(raw);
  if (
    raw.trim() === "" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100
  ) {
    throw new Error(
      `${flag} must be greater than 0 and at most 100 (got "${raw}")`,
    );
  }
  return value;
}

export function parseMinSessions(flag: string, raw: string): number {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(value) || value < 1) {
    throw new Error(
      `${flag} must be a whole number of 1 or more (got "${raw}")`,
    );
  }
  return value;
}

/**
 * Turn the routing and auto-abort flags into API fields. Throws on invalid
 * combinations before any request is made.
 */
export function buildCanarySettings(
  input: CanaryFlagInput,
): CanarySettingsInput {
  const out: CanarySettingsInput = {};

  if (input.routing !== undefined) {
    out.routing_mode = parseRoutingFlag(input.routing);
  }
  if (out.routing_mode === "customer_context") {
    if (!input.contextField?.trim()) {
      throw new Error(
        "--context-field is required with --routing customer-context",
      );
    }
    out.routing_context_field = input.contextField.trim();
  } else if (input.contextField !== undefined) {
    throw new Error(
      "--context-field can only be used with --routing customer-context",
    );
  }

  if (input.autoAbort === false) {
    if (
      input.autoAbortRate !== undefined ||
      input.autoAbortMinSessions !== undefined
    ) {
      throw new Error(
        "--no-auto-abort cannot be combined with --auto-abort-rate or --auto-abort-min-sessions",
      );
    }
    out.auto_abort_enabled = false;
  }
  if (input.autoAbortRate !== undefined) {
    out.max_failure_rate_pct = parseRatePct(
      "--auto-abort-rate",
      input.autoAbortRate,
    );
  }
  if (input.autoAbortMinSessions !== undefined) {
    out.min_sessions = parseMinSessions(
      "--auto-abort-min-sessions",
      input.autoAbortMinSessions,
    );
  }
  return out;
}
