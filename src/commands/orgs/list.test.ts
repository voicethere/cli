import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOrgsList } from "./list.js";

const listOrgs = vi.fn();
const requireUserCommandSession = vi.fn();

vi.mock("../../lib/user-api.js", () => ({
  createUserApi: vi.fn(() => ({ listOrgs })),
}));

vi.mock("../../lib/user-session.js", () => ({
  requireUserCommandSession: (...args: unknown[]) =>
    requireUserCommandSession(...args),
}));

describe("runOrgsList", () => {
  beforeEach(() => {
    listOrgs.mockReset();
    requireUserCommandSession.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireUserCommandSession.mockResolvedValue({
      api_base: "https://app.voicethere.dev/api/v1",
      auth: {
        kind: "user_api_key",
        token: "vthu_test",
        activeOrgId: "org-1",
      },
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
