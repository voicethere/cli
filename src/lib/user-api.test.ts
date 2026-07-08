import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ORG_ID_HEADER, UserApi } from "./user-api.js";

describe("UserApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ orgs: [], active_org_id: "org-1" }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Bearer user key and org header", async () => {
    const api = new UserApi("https://app.voicethere.dev/api/v1", {
      kind: "user_api_key",
      token: "vthu_secret",
      activeOrgId: "org-42",
    });

    await api.listOrgs();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBe("Bearer vthu_secret");
    expect(init.headers[USER_ORG_ID_HEADER]).toBe("org-42");
  });

  it("sends dashboard cookie for legacy auth", async () => {
    const api = new UserApi("https://app.voicethere.dev/api/v1", {
      kind: "dashboard_cookie",
      cookie: "session=legacy",
    });

    await api.listOrgs();

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Cookie).toBe("session=legacy");
    expect(init.headers.Authorization).toBeUndefined();
  });
});
