import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEVICE_GRANT_TYPE,
  DeviceLoginError,
  pollDeviceTokenOnce,
  waitForDeviceAuthorization,
} from "./device-login.js";
import type { PollRuntime } from "./poll-backoff.js";

describe("device-login polling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps authorization_pending and slow_down with Retry-After", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending", interval: 5 }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow_down", interval: 8 }), {
          status: 400,
          headers: { "Retry-After": "7" },
        }),
      );

    const pending = await pollDeviceTokenOnce(
      "https://app.example/api/v1",
      "device-secret",
      "voicethere-cli/test",
    );
    expect(pending).toEqual({
      status: "pending",
      intervalSeconds: 5,
      retryAfterMs: null,
    });

    const slow = await pollDeviceTokenOnce(
      "https://app.example/api/v1",
      "device-secret",
      "voicethere-cli/test",
    );
    expect(slow.status).toBe("slow_down");
    if (slow.status === "slow_down") {
      expect(slow.retryAfterMs).toBe(7000);
      expect(slow.intervalSeconds).toBe(8);
    }

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      { body: string },
    ];
    const body = JSON.parse(init.body) as {
      grant_type: string;
      device_code: string;
    };
    expect(body.grant_type).toBe(DEVICE_GRANT_TYPE);
    expect(body.device_code).toBe("device-secret");
  });

  it("returns approved token payload without logging secrets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "vthu_plaintext",
          token_type: "Bearer",
          expires_in: 100,
          active_org_id: "11111111-1111-4111-8111-111111111111",
        }),
        { status: 200 },
      ),
    );

    const result = await pollDeviceTokenOnce(
      "https://app.example/api/v1",
      "device-secret",
      "ua",
    );
    expect(result).toEqual({
      status: "approved",
      accessToken: "vthu_plaintext",
      activeOrgId: "11111111-1111-4111-8111-111111111111",
      expiresIn: 100,
    });
  });

  it("maps denied and expired", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "access_denied" }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "expired_token" }), { status: 400 }),
      );

    await expect(
      pollDeviceTokenOnce("https://app.example/api/v1", "d", "ua"),
    ).resolves.toEqual({ status: "denied", description: undefined });
    await expect(
      pollDeviceTokenOnce("https://app.example/api/v1", "d", "ua"),
    ).resolves.toEqual({ status: "expired", description: undefined });
  });

  it("waits until approved then returns token", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "vthu_ok",
            token_type: "Bearer",
            expires_in: 50,
            active_org_id: "org-1",
          }),
          { status: 200 },
        ),
      );

    const runtime: PollRuntime = {
      sleep: async () => {},
      now: (() => {
        let t = 0;
        return () => {
          t += 1;
          return t;
        };
      })(),
      random: () => 0,
    };

    const token = await waitForDeviceAuthorization({
      apiBase: "https://app.example/api/v1",
      deviceCode: "device",
      userAgent: "ua",
      intervalSeconds: 1,
      expiresInSeconds: 30,
      runtime,
    });
    expect(token.access_token).toBe("vthu_ok");
    expect(token.active_org_id).toBe("org-1");
  });

  it("throws DeviceLoginError on denied and timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "access_denied" }), { status: 400 }),
    );

    await expect(
      waitForDeviceAuthorization({
        apiBase: "https://app.example/api/v1",
        deviceCode: "device",
        userAgent: "ua",
        intervalSeconds: 1,
        expiresInSeconds: 30,
        runtime: {
          sleep: async () => {},
          now: () => 0,
          random: () => 0,
        },
      }),
    ).rejects.toMatchObject({ code: "access_denied" } satisfies Partial<DeviceLoginError>);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "authorization_pending" }), {
        status: 400,
      }),
    );

    let now = 0;
    await expect(
      waitForDeviceAuthorization({
        apiBase: "https://app.example/api/v1",
        deviceCode: "device",
        userAgent: "ua",
        intervalSeconds: 1,
        expiresInSeconds: 1,
        runtime: {
          sleep: async () => {
            now += 10_000;
          },
          now: () => now,
          random: () => 0,
        },
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });
});
