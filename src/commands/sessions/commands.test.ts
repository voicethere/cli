import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApiError } from "../../lib/api.js";
import { runSessionsBilling } from "./billing.js";
import { runSessionsList } from "./list.js";
import { runSessionsRecording } from "./recording.js";
import { runSessionsRecordingDelete } from "./recording/delete.js";

const listProjectSessions = vi.fn();
const getProjectSession = vi.fn();
const getSessionRecording = vi.fn();
const deleteSessionRecording = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api.js")>();
  return {
    ...actual,
    createApi: vi.fn(() => ({
      listProjectSessions,
      getProjectSession,
      getSessionRecording,
      deleteSessionRecording,
    })),
  };
});

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("sessions commands", () => {
  beforeEach(() => {
    listProjectSessions.mockReset();
    getProjectSession.mockReset();
    getSessionRecording.mockReset();
    deleteSessionRecording.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn());

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runSessionsList", () => {
    it("lists sessions with pagination args", async () => {
      listProjectSessions.mockResolvedValue({
        sessions: [
          {
            id: "db-1",
            orchestrator_session_id: "orch-1",
            status: "ended",
            build_id: null,
            created_at: "2026-06-19T00:00:00.000Z",
            ended_at: "2026-06-19T00:01:00.000Z",
            end_reason: "client_disconnected",
            billable_seconds: 42,
            expires_at: null,
          },
        ],
        start: 0,
        end: 1,
        count: 3,
      });

      await runSessionsList({ start: 0, end: 10 });

      expect(listProjectSessions).toHaveBeenCalledWith("proj-1", {
        start: 0,
        end: 10,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("orch-1\tended\tbillable=42"),
      );
      expect(console.log).toHaveBeenCalledWith("\nShowing 1-1 of 3 sessions");
    });
  });

  describe("runSessionsBilling", () => {
    it("prints billing fields for a session", async () => {
      getProjectSession.mockResolvedValue({
        id: "db-1",
        orchestrator_session_id: "orch-1",
        status: "ended",
        build_id: null,
        created_at: "2026-06-19T00:00:00.000Z",
        ended_at: "2026-06-19T00:01:00.000Z",
        end_reason: "client_disconnected",
        billable_seconds: 42,
        expires_at: null,
      });

      await runSessionsBilling({ sessionId: "orch-1" });

      expect(getProjectSession).toHaveBeenCalledWith("proj-1", "orch-1");
      expect(console.log).toHaveBeenCalledWith("billable_seconds=42");
    });
  });

  describe("runSessionsRecording", () => {
    const readyPayload = {
      project_id: "proj-1",
      orchestrator_session_id: "orch-1",
      status: "ready" as const,
      format: "opus" as const,
      duration_ms: 12_345,
      byte_size: 4096,
      created_at: "2026-08-23T00:00:00.000Z",
      play_url: "https://example.com/recording.opus",
      play_url_expires_at: "2026-08-23T01:00:00.000Z",
    };

    it("prints recording metadata without wait", async () => {
      getSessionRecording.mockResolvedValue(readyPayload);

      await runSessionsRecording({ sessionId: "orch-1" });

      expect(getSessionRecording).toHaveBeenCalledWith("proj-1", "orch-1");
      expect(console.log).toHaveBeenCalledWith("status=ready");
      expect(console.log).toHaveBeenCalledWith(
        "play_url=https://example.com/recording.opus",
      );
    });

    it("writes binary recording when ready with --wait and --output", async () => {
      const dir = mkdtempSync(join(tmpdir(), "cli-recording-"));
      const outputPath = join(dir, "recording.opus");
      getSessionRecording.mockResolvedValue(readyPayload);
      const audio = Buffer.from([0x4f, 0x67, 0x67, 0x53]);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () =>
          audio.buffer.slice(
            audio.byteOffset,
            audio.byteOffset + audio.byteLength,
          ),
      } as Response);

      try {
        await runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          output: outputPath,
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        });

        expect(readFileSync(outputPath)).toEqual(audio);
        expect(console.log).toHaveBeenCalledWith(
          `Wrote ${audio.byteLength} byte(s) to ${outputPath}`,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("retries 404 not-found during --wait until ready", async () => {
      getSessionRecording
        .mockRejectedValueOnce(new ApiError(404, "Session recording not found"))
        .mockResolvedValueOnce(readyPayload);

      await runSessionsRecording({
        sessionId: "orch-1",
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 5_000,
      });

      expect(getSessionRecording).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith("status=ready");
    });

    it("times out when recording stays not-found during --wait", async () => {
      getSessionRecording.mockRejectedValue(
        new ApiError(404, "Session recording not found"),
      );

      await expect(
        runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          pollIntervalMs: 1,
          timeoutMs: 10,
        }),
      ).rejects.toThrow(
        /Timed out after 10ms waiting for session recording orch-1/,
      );
    });

    it("fails immediately on non-404 errors during --wait", async () => {
      getSessionRecording.mockRejectedValue(new ApiError(500, "server error"));

      await expect(
        runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/server error/);
      expect(getSessionRecording).toHaveBeenCalledTimes(1);
    });

    it("polls until ready then downloads", async () => {
      const dir = mkdtempSync(join(tmpdir(), "cli-recording-"));
      const outputPath = join(dir, "recording.opus");
      getSessionRecording
        .mockResolvedValueOnce({
          ...readyPayload,
          status: "pending",
          play_url: undefined,
        })
        .mockResolvedValueOnce(readyPayload);
      const audio = Buffer.from("audio-bytes");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () =>
          audio.buffer.slice(
            audio.byteOffset,
            audio.byteOffset + audio.byteLength,
          ),
      } as Response);

      try {
        await runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          output: outputPath,
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        });

        expect(getSessionRecording).toHaveBeenCalledTimes(2);
        expect(readFileSync(outputPath)).toEqual(audio);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("throws when recording status is failed", async () => {
      getSessionRecording.mockResolvedValue({
        ...readyPayload,
        status: "failed",
        play_url: undefined,
      });

      await expect(
        runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/Session recording failed/);
    });

    it("errors when --output is set without --wait", async () => {
      await expect(
        runSessionsRecording({
          sessionId: "orch-1",
          output: "/tmp/recording.opus",
        }),
      ).rejects.toThrow(/--output requires --wait/);
    });

    it("errors when ready payload is missing play_url with --output after wait", async () => {
      getSessionRecording.mockResolvedValue({
        ...readyPayload,
        status: "ready",
        play_url: undefined,
      });

      await expect(
        runSessionsRecording({
          sessionId: "orch-1",
          wait: true,
          output: "/tmp/recording.opus",
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/no play_url/);
    });
  });

  describe("runSessionsRecordingDelete", () => {
    it("deletes a session recording", async () => {
      deleteSessionRecording.mockResolvedValue(undefined);

      await runSessionsRecordingDelete({ sessionId: "orch-1" });

      expect(deleteSessionRecording).toHaveBeenCalledWith("proj-1", "orch-1");
      expect(console.log).toHaveBeenCalledWith(
        "Deleted session recording for orch-1",
      );
    });

    it("requires a session id", async () => {
      await expect(
        runSessionsRecordingDelete({ sessionId: "  " }),
      ).rejects.toThrow(/session id is required/);
      expect(deleteSessionRecording).not.toHaveBeenCalled();
    });
  });
});
