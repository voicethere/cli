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
    vi.useRealTimers();
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

  it("retries gateway failures before surfacing ApiError", async () => {
    vi.useFakeTimers();
    const body = JSON.stringify({
      error: {
        message: "gateway timeout",
        request_id: "req-u",
        error_id: "err-u",
      },
    });
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 504,
        text: async () => body,
      }),
    );

    const api = new UserApi("https://app.voicethere.dev/api/v1", {
      kind: "user_api_key",
      token: "vthu_secret",
    });

    const assertion = expect(api.listOrgs()).rejects.toMatchObject({
      name: "ApiError",
      status: 504,
      message: "gateway timeout",
      requestId: "req-u",
      errorId: "err-u",
    });

    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(8);
    vi.useRealTimers();
  });
});
