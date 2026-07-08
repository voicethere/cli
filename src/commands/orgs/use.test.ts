import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOrgsUse } from "./use.js";

const setActiveOrg = vi.fn();
const patchCredentials = vi.fn();
const requireUserCommandSession = vi.fn();

vi.mock("../../lib/user-api.js", () => ({
  createUserApi: vi.fn(() => ({ setActiveOrg })),
}));

vi.mock("../../lib/config.js", () => ({
  patchCredentials: (...args: unknown[]) => patchCredentials(...args),
}));

vi.mock("../../lib/user-session.js", () => ({
  requireUserCommandSession: (...args: unknown[]) =>
    requireUserCommandSession(...args),
}));

describe("runOrgsUse", () => {
  beforeEach(() => {
    setActiveOrg.mockReset();
    patchCredentials.mockReset();
    requireUserCommandSession.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireUserCommandSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      auth: {
        kind: "user_api_key",
        token: "vthu_test",
        activeOrgId: "org-old",
      },
    });
    patchCredentials.mockResolvedValue({});
  });

  it("sets active org via API and persists active_org_id for user keys", async () => {
    await runOrgsUse("org-new");

    expect(setActiveOrg).toHaveBeenCalledWith("org-new");
    expect(patchCredentials).toHaveBeenCalledWith({ active_org_id: "org-new" });
    expect(console.log).toHaveBeenCalledWith(
      "Active organization set to org-new",
    );
  });

  it("skips credential patch for legacy dashboard cookie auth", async () => {
    requireUserCommandSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      auth: { kind: "dashboard_cookie", cookie: "session=abc" },
    });

    await runOrgsUse("org-new");

    expect(setActiveOrg).toHaveBeenCalledWith("org-new");
    expect(patchCredentials).not.toHaveBeenCalled();
  });
});
