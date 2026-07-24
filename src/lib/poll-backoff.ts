/** Multipliers applied to the base poll interval between polls without progress. */
export const POLL_BACKOFF_MULTIPLIERS = [1, 2, 3, 5] as const;

/** Upper bound for adaptive poll spacing (ms). */
export const POLL_INTERVAL_CAP_MS = 5_000;

/** Clamp bounds for optional server `retry_after_ms` hints. */
export const POLL_RETRY_AFTER_MIN_MS = 250;
export const POLL_RETRY_AFTER_MAX_MS = 5_000;

export type PollProgressSnapshot = {
  status: string;
  progressId?: string | null;
};

export type PollRuntime = {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const defaultPollRuntime: PollRuntime = {
  sleep: defaultSleep,
  now: () => Date.now(),
  random: () => Math.random(),
};

export function clampPollRetryAfterMs(
  retryAfterMs: number,
  bounds: { minMs?: number; maxMs?: number } = {},
): number {
  const minMs = bounds.minMs ?? POLL_RETRY_AFTER_MIN_MS;
  const maxMs = bounds.maxMs ?? POLL_RETRY_AFTER_MAX_MS;
  if (!Number.isFinite(retryAfterMs)) {
    return minMs;
  }
  return Math.min(maxMs, Math.max(minMs, Math.round(retryAfterMs)));
}

/**
 * Returns true when adaptive backoff should reset to the base interval — status
 * changed or a step/build identifier moved.
 */
export function shouldResetPollBackoff(
  previous: PollProgressSnapshot | null,
  current: PollProgressSnapshot,
): boolean {
  if (!previous) {
    return false;
  }
  if (previous.status !== current.status) {
    return true;
  }
  if (
    current.progressId != null &&
    previous.progressId !== current.progressId
  ) {
    return true;
  }
  return false;
}

/**
 * Computes the delay before the next status poll.
 * `attemptIndex` is the number of consecutive waits without progress (0 = first wait).
 */
export function computePollDelayMs(input: {
  baseIntervalMs: number;
  attemptIndex: number;
  retryAfterMs?: number | null;
  /** When false, omit jitter (deterministic tests). Default true. */
  jitter?: boolean;
  /** Returns [0, 1). Used for jitter when `jitter` is true. */
  random?: () => number;
}): number {
  const baseMs = Math.max(1, Math.round(input.baseIntervalMs));
  const capMs = Math.min(
    POLL_INTERVAL_CAP_MS,
    baseMs * POLL_BACKOFF_MULTIPLIERS.at(-1)!,
  );

  let delayMs: number;
  if (
    input.retryAfterMs != null &&
    Number.isFinite(input.retryAfterMs) &&
    input.retryAfterMs > 0
  ) {
    delayMs = clampPollRetryAfterMs(input.retryAfterMs);
  } else {
    const multiplierIndex = Math.min(
      Math.max(0, input.attemptIndex),
      POLL_BACKOFF_MULTIPLIERS.length - 1,
    );
    const multiplier = POLL_BACKOFF_MULTIPLIERS[multiplierIndex]!;
    delayMs = Math.min(baseMs * multiplier, capMs);
  }

  if (input.jitter !== false) {
    const random = input.random ?? Math.random;
    // ±20% jitter to avoid synchronized client polls.
    delayMs = Math.round(delayMs * (0.8 + random() * 0.4));
  }

  return Math.max(1, delayMs);
}

export async function pollWithBackoff<T>(options: {
  poll: () => Promise<T>;
  isTerminal: (value: T) => boolean;
  getProgress: (value: T) => PollProgressSnapshot;
  getRetryAfterMs?: (value: T) => number | null | undefined;
  onPoll?: (value: T) => void;
  baseIntervalMs: number;
  timeoutMs: number;
  timeoutMessage: string;
  runtime?: PollRuntime;
}): Promise<T> {
  const runtime = options.runtime ?? defaultPollRuntime;
  const started = runtime.now();
  let attemptIndex = 0;
  let previousProgress: PollProgressSnapshot | null = null;

  while (runtime.now() - started < options.timeoutMs) {
    const value = await options.poll();
    options.onPoll?.(value);
    if (options.isTerminal(value)) {
      return value;
    }

    const currentProgress = options.getProgress(value);
    if (shouldResetPollBackoff(previousProgress, currentProgress)) {
      attemptIndex = 0;
    }

    const delayMs = computePollDelayMs({
      baseIntervalMs: options.baseIntervalMs,
      attemptIndex,
      retryAfterMs: options.getRetryAfterMs?.(value),
      random: runtime.random,
    });
    previousProgress = currentProgress;
    attemptIndex += 1;

    await runtime.sleep(delayMs);
  }

  throw new Error(options.timeoutMessage);
}
