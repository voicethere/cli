import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAccountDeletionConfirm } from "./deletion.js";

const confirmAccountDeletion = vi.fn();
const getAccountDeletionJob = vi.fn();
const requireUserCommandSession = vi.fn();

vi.mock("../../lib/user-api.js", () => ({
  createUserApi: vi.fn(() => ({
    confirmAccountDeletion,
    getAccountDeletionJob,
  })),
}));

vi.mock("../../lib/user-session.js", () => ({
  requireUserCommandSession: (...args: unknown[]) =>
    requireUserCommandSession(...args),
}));

describe("runAccountDeletionConfirm", () => {
  beforeEach(() => {
    confirmAccountDeletion.mockReset();
    getAccountDeletionJob.mockReset();
    requireUserCommandSession.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireUserCommandSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      auth: { kind: "user_api_key", token: "vthu_test" },
    });
  });

  it("rejects invalid codes", async () => {
    await expect(runAccountDeletionConfirm("12")).rejects.toThrow(
      "code must be exactly 6 digits",
    );
  });

  it("prints queued job id on success without waiting", async () => {
    confirmAccountDeletion.mockResolvedValue({
      job_id: "job-1",
      poll_token: "poll-1",
    });

    await runAccountDeletionConfirm("123456");

    expect(confirmAccountDeletion).toHaveBeenCalledWith("123456");
    expect(getAccountDeletionJob).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("job-1"),
    );
  });

  it("polls until deletion completes when --wait is set", async () => {
    confirmAccountDeletion.mockResolvedValue({
      job_id: "job-1",
      poll_token: "poll-1",
    });
    getAccountDeletionJob
      .mockResolvedValueOnce({
        id: "job-1",
        status: "running",
        step: "undeploy_projects",
        error: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: null,
      })
      .mockResolvedValueOnce({
        id: "job-1",
        status: "completed",
        step: "delete_auth_user",
        error: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:01:00Z",
      });

    await runAccountDeletionConfirm("123456", {
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    expect(getAccountDeletionJob).toHaveBeenCalledWith("job-1", "poll-1");
    expect(console.log).toHaveBeenCalledWith(
      "Account deletion completed: job-1",
    );
  });

  it("throws when deletion fails after wait", async () => {
    confirmAccountDeletion.mockResolvedValue({
      job_id: "job-1",
      poll_token: "poll-1",
    });
    getAccountDeletionJob.mockResolvedValue({
      id: "job-1",
      status: "failed",
      step: "wait_undeploys",
      error: "undeploy timed out",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
    });

    await expect(
      runAccountDeletionConfirm("123456", {
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow(/undeploy timed out/);
  });
});
