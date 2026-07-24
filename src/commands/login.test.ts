import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api.js";
import {
  evaluateExistingCredentials,
  runLogin,
  shouldInitiateLoginForApiError,
} from "./login.js";
import { TOS_NOT_ACCEPTED_CODE } from "../lib/tos-gate.js";

describe("shouldInitiateLoginForApiError", () => {
  it("initiates for 401/403/404 and TOS", () => {
    expect(
      shouldInitiateLoginForApiError(new ApiError(401, "unauthorized")),
    ).toBe(true);
    expect(shouldInitiateLoginForApiError(new ApiError(403, "forbidden"))).toBe(
      true,
    );
    expect(shouldInitiateLoginForApiError(new ApiError(404, "missing"))).toBe(
      true,
    );
    expect(
      shouldInitiateLoginForApiError(
        new ApiError(403, "tos", {
          error: { code: TOS_NOT_ACCEPTED_CODE, message: "accept tos" },
        }),
      ),
    ).toBe(true);
  });

  it("does not initiate for network/5xx", () => {
    expect(shouldInitiateLoginForApiError(new Error("ECONNRESET"))).toBe(false);
    expect(shouldInitiateLoginForApiError(new ApiError(500, "boom"))).toBe(
      false,
    );
    expect(shouldInitiateLoginForApiError(new ApiError(503, "busy"))).toBe(
      false,
    );
  });
});

describe("runLogin", () => {
  let credentialsPath: string;
  let workspace: string;

  beforeEach(async () => {
    const dir = join(tmpdir(), `voicethere-cli-${Date.now()}-${Math.random()}`);
    await mkdir(dir, { recursive: true });
    credentialsPath = join(dir, "credentials.json");
    workspace = join(dir, "repo");
    await mkdir(workspace, { recursive: true });
    process.env.VOICETHERE_CREDENTIALS_PATH = credentialsPath;
    delete process.env.VOICETHERE_API_KEY;
    delete process.env.VOICETHERE_USER_API_KEY;
    delete process.env.VOICETHERE_ORG_ID;
    delete process.env.VOICETHERE_API_BASE;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    delete process.env.VOICETHERE_CREDENTIALS_PATH;
    delete process.env.VOICETHERE_API_KEY;
    delete process.env.VOICETHERE_USER_API_KEY;
    delete process.env.VOICETHERE_ORG_ID;
    delete process.env.VOICETHERE_API_BASE;
    vi.restoreAllMocks();
    await rm(dirname(credentialsPath), { recursive: true, force: true });
  });

  it("manual path stores org key and user API key with 0600", async () => {
    await runLogin({
      apiKey: "vth_org_key",
      apiBase: "https://app.voicethere.dev/api/v1",
      userApiKey: "vthu_personal_key",
    });

    const fileStat = await stat(credentialsPath);
    expect(fileStat.mode & 0o777).toBe(0o600);

    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      api_key: string;
      user_api_key?: string;
      api_base: string;
      dashboard_session_cookie?: string;
    };
    expect(parsed.api_key).toBe("vth_org_key");
    expect(parsed.user_api_key).toBe("vthu_personal_key");
    expect(parsed.api_base).toBe("https://app.voicethere.dev/api/v1");
    expect(parsed.dashboard_session_cookie).toBeUndefined();
  });

  it("manual path allows user-api-key only", async () => {
    await runLogin({
      userApiKey: "vthu_only",
      apiBase: "https://app.voicethere.dev/api/v1",
    });
    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      api_key?: string;
      user_api_key?: string;
    };
    expect(parsed.api_key).toBeUndefined();
    expect(parsed.user_api_key).toBe("vthu_only");
  });

  it("preserves active_org_id when re-logging in without explicit user api key", async () => {
    await runLogin({
      apiKey: "vth_org_key",
      userApiKey: "vthu_personal_key",
    });

    const withOrg = {
      ...JSON.parse(await readFile(credentialsPath, "utf8")),
      active_org_id: "org-abc",
    };
    await writeFile(
      credentialsPath,
      `${JSON.stringify(withOrg, null, 2)}\n`,
      "utf8",
    );

    await runLogin({ apiKey: "vth_new_org_key" });

    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      api_key: string;
      active_org_id?: string;
    };
    expect(parsed.api_key).toBe("vth_new_org_key");
    expect(parsed.active_org_id).toBe("org-abc");
  });

  it("clears active_org_id when an explicit user api key is provided", async () => {
    await runLogin({
      apiKey: "vth_org_key",
      userApiKey: "vthu_personal_key",
    });
    const withOrg = {
      ...JSON.parse(await readFile(credentialsPath, "utf8")),
      active_org_id: "org-abc",
    };
    await writeFile(
      credentialsPath,
      `${JSON.stringify(withOrg, null, 2)}\n`,
      "utf8",
    );

    await runLogin({
      apiKey: "vth_new_org_key",
      userApiKey: "vthu_new_personal_key",
    });

    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      user_api_key?: string;
      active_org_id?: string;
    };
    expect(parsed.user_api_key).toBe("vthu_new_personal_key");
    expect(parsed.active_org_id).toBeUndefined();
  });

  it("skips browser login when credentials already work", async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        api_key: "vth_ok",
        api_base: "https://app.voicethere.dev/api/v1",
      }),
      "utf8",
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ projects: [] }), { status: 200 }),
    );

    const openBrowserFn = vi.fn();
    await runLogin({
      cwd: workspace,
      openBrowserFn,
      cliVersion: "9.9.9",
    });

    expect(openBrowserFn).not.toHaveBeenCalled();
    const bodies = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(
      bodies.some((call) => String(call[0]).includes("/cli/device/authorize")),
    ).toBe(false);
  });

  it("aborts on 5xx without initiating device login", async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        api_key: "vth_ok",
        api_base: "https://app.voicethere.dev/api/v1",
      }),
      "utf8",
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "down" } }), {
        status: 503,
      }),
    );

    await expect(
      runLogin({ cwd: workspace, openBrowserFn: vi.fn(), cliVersion: "1.0.0" }),
    ).rejects.toThrow(/Could not validate credentials/);
  });

  it("browser login polls, saves vthu_, clears cookie, honors --no-open and --force", async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        api_key: "vth_legacy",
        api_base: "https://app.voicethere.dev/api/v1",
        dashboard_session_cookie: "session=old",
        user_api_key: "vthu_old",
        active_org_id: "org-old",
      }),
      "utf8",
    );

    const openBrowserFn = vi.fn(async () => {
      throw new Error("should not open");
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "device-secret-code",
            user_code: "ABCD-EFGH",
            verification_uri: "https://app.voicethere.dev/cli/authorize",
            verification_uri_complete:
              "https://app.voicethere.dev/cli/authorize?user_code=ABCD-EFGH",
            expires_in: 600,
            interval: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "vthu_new_from_browser",
            token_type: "Bearer",
            expires_in: 7776000,
            active_org_id: "org-new",
          }),
          { status: 200 },
        ),
      );

    await runLogin({
      force: true,
      noOpen: true,
      openBrowserFn,
      cliVersion: "1.2.3",
      cwd: workspace,
      pollRuntime: {
        sleep: async () => {},
        now: (() => {
          let t = 0;
          return () => {
            t += 1;
            return t;
          };
        })(),
        random: () => 0,
      },
    });

    expect(openBrowserFn).not.toHaveBeenCalled();
    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      api_key?: string;
      user_api_key?: string;
      active_org_id?: string;
      dashboard_session_cookie?: string;
    };
    expect(parsed.api_key).toBeUndefined();
    expect(parsed.user_api_key).toBe("vthu_new_from_browser");
    expect(parsed.active_org_id).toBe("org-new");
    expect(parsed.dashboard_session_cookie).toBeUndefined();

    const logCalls = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls as unknown[][];
    const lines = logCalls.map((call) => String(call[0] ?? ""));
    expect(
      lines.some((line) =>
        line.startsWith("voicethere-login:verification_uri_complete="),
      ),
    ).toBe(true);
    expect(
      lines.some((line) => line === "voicethere-login:user_code=ABCD-EFGH"),
    ).toBe(true);
    expect(
      lines.some((line) => line === "voicethere-login:status=completed"),
    ).toBe(true);
    expect(lines.join("\n")).not.toMatch(
      /device-secret-code|vthu_new_from_browser/,
    );
  });

  it("aborts browser login when VOICETHERE_API_KEY / USER_API_KEY would override a minted key", async () => {
    process.env.VOICETHERE_API_KEY = "vth_env_invalid";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      runLogin({
        force: true,
        noOpen: true,
        openBrowserFn: vi.fn(),
        cliVersion: "1.0.0",
        cwd: workspace,
      }),
    ).rejects.toThrow(/VOICETHERE_API_KEY/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("verifies linked project with minted vthu_ before emitting completed", async () => {
    await mkdir(join(workspace, ".voicethere"), { recursive: true });
    const projectId = "33333333-3333-4333-8333-333333333333";
    await writeFile(
      join(workspace, ".voicethere", "config.json"),
      JSON.stringify({ project_id: projectId }),
      "utf8",
    );

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "device-secret-code",
            user_code: "ABCD-EFGH",
            verification_uri: "https://app.voicethere.dev/cli/authorize",
            verification_uri_complete:
              "https://app.voicethere.dev/cli/authorize?user_code=ABCD-EFGH",
            expires_in: 600,
            interval: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "vthu_minted_verify",
            token_type: "Bearer",
            expires_in: 7776000,
            active_org_id: "org-verify",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: projectId,
            slug: "linked-agent",
            name: "Linked",
          }),
          { status: 200 },
        ),
      );

    await runLogin({
      force: true,
      noOpen: true,
      openBrowserFn: vi.fn(),
      cliVersion: "1.2.3",
      cwd: workspace,
      pollRuntime: {
        sleep: async () => {},
        now: () => 1,
        random: () => 0,
      },
    });

    const projectGet = fetchSpy.mock.calls[2]!;
    expect(String(projectGet[0])).toContain(`/projects/${projectId}`);
    expect((projectGet[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer vthu_minted_verify",
      "x-voicethere-org-id": "org-verify",
    });

    const logCalls = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls as unknown[][];
    const lines = logCalls.map((call) => String(call[0] ?? ""));
    const completedIdx = lines.findIndex(
      (line) => line === "voicethere-login:status=completed",
    );
    expect(completedIdx).toBeGreaterThan(-1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("fails login when linked project is inaccessible to minted key", async () => {
    await mkdir(join(workspace, ".voicethere"), { recursive: true });
    await writeFile(
      join(workspace, ".voicethere", "config.json"),
      JSON.stringify({
        project_id: "44444444-4444-4444-8444-444444444444",
      }),
      "utf8",
    );

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "device-secret-code",
            user_code: "ABCD-EFGH",
            verification_uri: "https://app.voicethere.dev/cli/authorize",
            verification_uri_complete:
              "https://app.voicethere.dev/cli/authorize?user_code=ABCD-EFGH",
            expires_in: 600,
            interval: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "vthu_minted_bad_project",
            token_type: "Bearer",
            expires_in: 7776000,
            active_org_id: "org-verify",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "forbidden" } }), {
          status: 403,
        }),
      );

    await expect(
      runLogin({
        force: true,
        noOpen: true,
        openBrowserFn: vi.fn(),
        cliVersion: "1.2.3",
        cwd: workspace,
        pollRuntime: {
          sleep: async () => {},
          now: () => 1,
          random: () => 0,
        },
      }),
    ).rejects.toThrow(/linked project could not be accessed/);

    const logCalls = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls as unknown[][];
    const lines = logCalls.map((call) => String(call[0] ?? ""));
    expect(lines).toContain(
      "voicethere-login:status=linked_project_inaccessible",
    );
    expect(lines).not.toContain("voicethere-login:status=completed");

    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      user_api_key?: string;
      api_key?: string;
    };
    expect(parsed.user_api_key).toBe("vthu_minted_bad_project");
    expect(parsed.api_key).toBeUndefined();
    expect(
      await readFile(join(workspace, ".voicethere", "config.json"), "utf8"),
    ).toContain("44444444-4444-4444-8444-444444444444");
  });

  it("initiates login with requested_project_id on linked project 403", async () => {
    await mkdir(join(workspace, ".voicethere"), { recursive: true });
    await writeFile(
      join(workspace, ".voicethere", "config.json"),
      JSON.stringify({
        project_id: "22222222-2222-4222-8222-222222222222",
      }),
      "utf8",
    );
    await writeFile(
      credentialsPath,
      JSON.stringify({
        api_key: "vth_stale",
        api_base: "https://app.voicethere.dev/api/v1",
      }),
      "utf8",
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "forbidden" } }), {
        status: 403,
      }),
    );

    const decision = await evaluateExistingCredentials({ cwd: workspace });
    expect(decision).toEqual({
      action: "login",
      reason: "API 403",
      requestedProjectId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
