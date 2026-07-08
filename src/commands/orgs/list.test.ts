import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOrgsList } from "./list.js";

const listOrgs = vi.fn();
const requireDashboardSession = vi.fn();

vi.mock("../../lib/dashboard-api.js", () => ({
  createDashboardApi: vi.fn(() => ({ listOrgs })),
}));

vi.mock("../../lib/dashboard-session.js", () => ({
  requireDashboardSession: (...args: unknown[]) =>
    requireDashboardSession(...args),
}));

describe("runOrgsList", () => {
  beforeEach(() => {
    listOrgs.mockReset();
    requireDashboardSession.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireDashboardSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      cookie: "session=abc",
    });
  });

  it("prints organizations with active marker", async () => {
    listOrgs.mockResolvedValue({
      active_org_id: "org-1",
      orgs: [
        {
          id: "org-1",
          slug: "acme",
          name: "Acme",
          owner_user_id: "user-1",
          is_owner: true,
        },
      ],
    });

    await runOrgsList();

    expect(console.log).toHaveBeenCalledWith(
      "*\torg-1\tacme\tAcme\towner",
    );
  });
});
