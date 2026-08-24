import { writeFile } from "node:fs/promises";

import type { SessionRecordingPlayPayload } from "../../lib/api.js";
import { logStep, logVerbose } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { pollWithBackoff } from "../../lib/poll-backoff.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface SessionsRecordingOptions {
  sessionId: string;
  projectId?: string;
  wait?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  output?: string;
  json?: boolean;
}

const RECORDING_TERMINAL_STATUSES = new Set(["ready", "failed"]);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function defaultRecordingTimeoutMs(): number {
  return parsePositiveInt(
    process.env.VOICETHERE_SESSION_RECORDING_TIMEOUT_MS,
    120_000,
  );
}

function defaultRecordingPollIntervalMs(): number {
  return parsePositiveInt(
    process.env.VOICETHERE_SESSION_RECORDING_POLL_MS,
    2_500,
  );
}

function isRecordingReady(payload: SessionRecordingPlayPayload): boolean {
  return payload.status === "ready" && Boolean(payload.play_url?.trim());
}

async function downloadRecordingArtifact(
  playUrl: string,
  outputPath: string,
): Promise<number> {
  const response = await fetch(playUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download session recording (${response.status} ${response.statusText})`,
    );
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength <= 0) {
    throw new Error("Session recording download returned empty body");
  }
  await writeFile(outputPath, body);
  return body.byteLength;
}

async function pollSessionRecording(
  api: ReturnType<typeof createApiFromCredentials>,
  projectId: string,
  sessionId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<SessionRecordingPlayPayload> {
  const payload = await pollWithBackoff({
    poll: () => api.getSessionRecording(projectId, sessionId),
    isTerminal: (recording) => RECORDING_TERMINAL_STATUSES.has(recording.status),
    getProgress: (recording) => ({
      status: recording.status,
      progressId: recording.play_url ?? null,
    }),
    onPoll: (recording) =>
      logVerbose(
        `session recording ${sessionId}: status=${recording.status} duration_ms=${recording.duration_ms} byte_size=${recording.byte_size}`,
      ),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for session recording ${sessionId}`,
  });

  if (payload.status === "failed") {
    throw new Error(`Session recording failed for ${sessionId}`);
  }
  if (!payload.play_url?.trim()) {
    throw new Error(
      `Session recording is ready but no play_url was returned for ${sessionId}`,
    );
  }

  return payload;
}

function printRecordingPayload(payload: SessionRecordingPlayPayload): void {
  console.log(`status=${payload.status}`);
  console.log(`format=${payload.format}`);
  console.log(`duration_ms=${payload.duration_ms}`);
  console.log(`byte_size=${payload.byte_size}`);
  if (payload.play_url) {
    console.log(`play_url=${payload.play_url}`);
  }
  if (payload.play_url_expires_at) {
    console.log(`play_url_expires_at=${payload.play_url_expires_at}`);
  }
}

export async function runSessionsRecording(
  options: SessionsRecordingOptions,
): Promise<void> {
  const sessionId = options.sessionId.trim();
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const outputPath = options.output?.trim();
  if (outputPath && !options.wait) {
    throw new Error(
      "--output requires --wait (recording must be ready before download)",
    );
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Fetching session recording for ${sessionId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);

  let payload: SessionRecordingPlayPayload;
  if (options.wait) {
    logStep("Waiting for session recording to become ready");
    payload = await pollSessionRecording(api, projectId, sessionId, {
      pollIntervalMs: options.pollIntervalMs ?? defaultRecordingPollIntervalMs(),
      timeoutMs: options.timeoutMs ?? defaultRecordingTimeoutMs(),
    });
  } else {
    payload = await api.getSessionRecording(projectId, sessionId);
    logVerbose(
      `status=${payload.status} duration_ms=${payload.duration_ms} byte_size=${payload.byte_size}`,
    );

    if (outputPath) {
      if (!isRecordingReady(payload)) {
        throw new Error(
          "--output requires --wait when recording is not ready (no play_url yet)",
        );
      }
    }
  }

  if (outputPath) {
    const playUrl = payload.play_url?.trim();
    if (!playUrl) {
      throw new Error(
        "Recording is not ready for download (missing play_url); use --wait",
      );
    }
    logStep(`Writing recording to ${outputPath}`);
    const bytesWritten = await downloadRecordingArtifact(playUrl, outputPath);
    console.log(`Wrote ${bytesWritten} byte(s) to ${outputPath}`);
  }

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!outputPath) {
    printRecordingPayload(payload);
  }
}
