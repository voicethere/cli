import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAccountDeletionConfirm } from "./deletion.js";

const confirmAccountDeletion = vi.fn();
const requireDashboardSession = vi.fn();

vi.mock("../../lib/dashboard-api.js", () => ({
  createDashboardApi: vi.fn(() => ({ confirmAccountDeletion })),
}));

vi.mock("../../lib/dashboard-session.js", () => ({
  requireDashboardSession: (...args: unknown[]) =>
    requireDashboardSession(...args),
}));

describe("runAccountDeletionConfirm", () => {
  beforeEach(() => {
    confirmAccountDeletion.mockReset();
    requireDashboardSession.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireDashboardSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      cookie: "session=abc",
    });
  });

  it("rejects invalid codes", async () => {
    await expect(runAccountDeletionConfirm("12")).rejects.toThrow(
      "code must be exactly 6 digits",
    );
  });

  it("prints queued job id on success", async () => {
    confirmAccountDeletion.mockResolvedValue({ job_id: "job-1" });

    await runAccountDeletionConfirm("123456");

    expect(confirmAccountDeletion).toHaveBeenCalledWith("123456");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("job-1"),
    );
  });
});
