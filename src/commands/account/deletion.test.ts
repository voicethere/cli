import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAccountDeletionConfirm } from "./deletion.js";

const confirmAccountDeletion = vi.fn();
const requireUserCommandSession = vi.fn();

vi.mock("../../lib/user-api.js", () => ({
  createUserApi: vi.fn(() => ({ confirmAccountDeletion })),
}));

vi.mock("../../lib/user-session.js", () => ({
  requireUserCommandSession: (...args: unknown[]) =>
    requireUserCommandSession(...args),
}));

describe("runAccountDeletionConfirm", () => {
  beforeEach(() => {
    confirmAccountDeletion.mockReset();
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

  it("prints queued job id on success", async () => {
    confirmAccountDeletion.mockResolvedValue({ job_id: "job-1" });

    await runAccountDeletionConfirm("123456");

    expect(confirmAccountDeletion).toHaveBeenCalledWith("123456");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("job-1"),
    );
  });
});
