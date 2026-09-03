import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, formatCliError, VoicethereApi } from "./api.js";
import {
  DEFAULT_API_BASE,
  getCredentialsPath,
  readCredentials,
  resolveEffectiveCredentials,
  writeCredentials,
} from "./config.js";
import { slugifyName } from "../commands/projects/create.js";

describe("config", () => {
  let tempDir: string;
  let credentialsPath: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-cli-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    credentialsPath = join(tempDir, "credentials.json");
    process.env.VOICETHERE_CREDENTIALS_PATH = credentialsPath;
    delete process.env.VOICETHERE_API_KEY;
    delete process.env.VOICETHERE_USER_API_KEY;
  });

  afterEach(async () => {
    delete process.env.VOICETHERE_CREDENTIALS_PATH;
    delete process.env.VOICETHERE_API_BASE;
    delete process.env.VOICETHERE_API_KEY;
    delete process.env.VOICETHERE_USER_API_KEY;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uses override path from VOICETHERE_CREDENTIALS_PATH", () => {
    expect(getCredentialsPath()).toBe(credentialsPath);
  });

  it("defaults api_base to production URL", () => {
    expect(DEFAULT_API_BASE).toBe("https://app.voicethere.io/api/v1");
  });

  it("VOICETHERE_API_BASE env overrides file and DEFAULT_API_BASE", async () => {
    await writeCredentials({
      api_key: "vth_env_override",
      api_base: "https://file.example.com/api/v1",
    });
    process.env.VOICETHERE_API_BASE = "https://app.voicethere.dev/api/v1";

    const effective = await resolveEffectiveCredentials();
    expect(effective).toMatchObject({
      api_key: "vth_env_override",
      api_base: "https://app.voicethere.dev/api/v1",
      apiBaseFromEnv: true,
    });
  });

  it("writes and reads credentials with mode 0600", async () => {
    await writeCredentials({
      api_key: "vth_dev_test_key",
      api_base: "https://app.voicethere.dev/api/v1",
    });

    const fileStat = await stat(credentialsPath);
    expect(fileStat.mode & 0o777).toBe(0o600);

    const raw = await readFile(credentialsPath, "utf8");
    expect(JSON.parse(raw)).toEqual({
      api_key: "vth_dev_test_key",
      api_base: "https://app.voicethere.dev/api/v1",
    });

    const credentials = await readCredentials();
    expect(credentials).toEqual({
      api_key: "vth_dev_test_key",
      api_base: "https://app.voicethere.dev/api/v1",
    });
  });

  it("returns null when credentials file is missing", async () => {
    await expect(readCredentials()).resolves.toBeNull();
  });

  it("creates parent directory when missing", async () => {
    credentialsPath = join(tempDir, "nested", "credentials.json");
    process.env.VOICETHERE_CREDENTIALS_PATH = credentialsPath;

    await writeCredentials({
      api_key: "vth_dev_nested",
      api_base: DEFAULT_API_BASE,
    });

    const credentials = await readCredentials();
    expect(credentials?.api_key).toBe("vth_dev_nested");
  });

  it("re-applies chmod on existing file", async () => {
    await mkdir(tempDir, { recursive: true });
    await writeCredentials({
      api_key: "vth_dev_chmod",
      api_base: DEFAULT_API_BASE,
    });
    await chmod(credentialsPath, 0o644);

    await writeCredentials({
      api_key: "vth_dev_chmod",
      api_base: DEFAULT_API_BASE,
    });

    const fileStat = await stat(credentialsPath);
    expect(fileStat.mode & 0o777).toBe(0o600);
  });

  it("accepts user_api_key-only credentials and defaults api_base", async () => {
    await mkdir(tempDir, { recursive: true });
    await writeFile(
      credentialsPath,
      JSON.stringify({ user_api_key: "vthu_solo" }),
      "utf8",
    );
    const credentials = await readCredentials();
    expect(credentials).toEqual({
      user_api_key: "vthu_solo",
      api_base: DEFAULT_API_BASE,
    });
  });

  it("accepts both api_key and user_api_key", async () => {
    await writeCredentials({
      api_key: "vth_org",
      user_api_key: "vthu_user",
      api_base: DEFAULT_API_BASE,
      active_org_id: "org-1",
    });
    await expect(readCredentials()).resolves.toEqual({
      api_key: "vth_org",
      user_api_key: "vthu_user",
      api_base: DEFAULT_API_BASE,
      active_org_id: "org-1",
    });
  });
});

describe("slugifyName", () => {
  it("lowercases and hyphenates names", () => {
    expect(slugifyName("My Voice Agent")).toBe("my-voice-agent");
  });

  it("strips leading and trailing punctuation", () => {
    expect(slugifyName("  --Hello World!!  ")).toBe("hello-world");
  });
});

describe("formatCliError", () => {
  it("formats ApiError with error_id and request_id", () => {
    const error = new ApiError(400, "bad input", {
      error: {
        message: "bad input",
        request_id: "req-abc",
        error_id: "err-xyz",
      },
    });

    expect(formatCliError(error)).toBe(
      "Error: bad input\nerror_id: err-xyz\nrequest_id: req-abc",
    );
  });

  it("omits missing ApiError metadata lines", () => {
    const error = new ApiError(500, "oops");
    expect(formatCliError(error)).toBe("Error: oops");
  });

  it("formats generic errors on one line", () => {
    expect(formatCliError(new Error("boom"))).toBe("Error: boom");
    expect(formatCliError("plain")).toBe("Error: plain");
  });
});

describe("VoicethereApi", () => {
  const apiKey = "vth_dev_test";
  const apiBase = "https://app.voicethere.dev/api/v1";

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("lists projects with bearer auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "proj-1",
              org_id: "org-1",
              name: "Demo",
              slug: "demo",
              active_build_id: null,
              created_at: "2026-06-09T12:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const projects = await api.listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.slug).toBe("demo");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects`);
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${apiKey}`,
    });
    expect(
      (init.headers as Record<string, string>)["x-voicethere-org-id"],
    ).toBeUndefined();
  });

  it("sends x-voicethere-org-id for personal user keys", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ projects: [] }), { status: 200 }),
      );

    const api = new VoicethereApi("vthu_personal", apiBase, {
      orgId: "org-header",
    });
    await api.listProjects();

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBe("Bearer vthu_personal");
    expect(init.headers["x-voicethere-org-id"]).toBe("org-header");
  });

  it("creates a project with JSON body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "proj-2",
          org_id: "org-1",
          name: "CLI Smoke",
          slug: "cli-smoke",
          active_build_id: null,
          created_at: "2026-06-09T12:00:00.000Z",
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const project = await api.createProject("CLI Smoke", "cli-smoke");

    expect(project.slug).toBe("cli-smoke");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ name: "CLI Smoke", slug: "cli-smoke" }),
    );
  });

  it("throws ApiError with server message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "NWRTC_UNAUTHORIZED",
            message: "Invalid API key",
            request_id: "req-1",
            error_id: "err-uuid-1",
          },
        }),
        { status: 401 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    await expect(api.listProjects()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "NWRTC_UNAUTHORIZED",
      message: "Invalid API key",
      requestId: "req-1",
      errorId: "err-uuid-1",
    } satisfies Partial<ApiError>);
  });

  it("retries on gateway status then throws ApiError", async () => {
    vi.useFakeTimers();
    const body = JSON.stringify({
      error: {
        code: "GATEWAY",
        message: "upstream unavailable",
        request_id: "req-gw",
        error_id: "err-gw",
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(body, { status: 503 })),
      );

    const api = new VoicethereApi(apiKey, apiBase);
    const assertion = expect(api.listProjects()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "upstream unavailable",
      requestId: "req-gw",
      errorId: "err-gw",
    });

    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(8);
    vi.useRealTimers();
  });

  it("retries on network error then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projects: [] }), { status: 200 }),
      );

    const api = new VoicethereApi(apiKey, apiBase);
    const promise = api.listProjects();
    await vi.runAllTimersAsync();
    const projects = await promise;

    expect(projects).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("uploads a build with optional message field", async () => {
    const bundleDir = join(
      tmpdir(),
      `voicethere-cli-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(bundleDir, { recursive: true });
    const bundlePath = join(bundleDir, "agent.js");
    await writeFile(bundlePath, "export default {};\n");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "build-1",
          project_id: "proj-1",
          size_bytes: 100,
          checksum_sha256: "abc",
          validation_status: "passed",
          message: "Fix greeting",
          created_at: "2026-06-09T12:00:00.000Z",
        }),
        { status: 201 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const build = await api.uploadBuild("proj-1", bundlePath, "Fix greeting");

    expect(build.message).toBe("Fix greeting");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("message")).toBe("Fix greeting");

    await rm(bundleDir, { recursive: true, force: true });
  });

  it("promotes a build", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          active_build_id: "build-1",
          active_storage_path: "org/org-1/project/proj-1/active/bundle.js",
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.promote("proj-1", "build-1");

    expect(result.active_build_id).toBe("build-1");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/promote`);
    expect(init.body).toBe(JSON.stringify({ build_id: "build-1" }));
  });

  it("lists project environment variables", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          variables: [{ key: "LOG_LEVEL", value: "debug" }],
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.listProjectEnvironment("proj-1");

    expect(result.variables).toHaveLength(1);
    expect(result.variables[0]?.key).toBe("LOG_LEVEL");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/environment`);
    expect(init.method).toBe("GET");
  });

  it("gets a single environment variable with encoded key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ key: "MY/KEY", value: "secret-ish" }), {
        status: 200,
      }),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const entry = await api.getProjectEnvironmentVariable("proj-1", "MY/KEY");

    expect(entry.value).toBe("secret-ish");
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/environment/MY%2FKEY");
  });

  it("upserts an environment variable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ key: "REGION", value: "us-east" }), {
        status: 200,
      }),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const entry = await api.upsertProjectEnvironmentVariable(
      "proj-1",
      "REGION",
      "us-east",
    );

    expect(entry.key).toBe("REGION");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/environment/REGION");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ value: "us-east" }));
  });

  it("deletes an environment variable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const api = new VoicethereApi(apiKey, apiBase);
    await api.deleteProjectEnvironmentVariable("proj-1", "OLD_KEY");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/environment/OLD_KEY");
    expect(init.method).toBe("DELETE");
  });

  it("lists project secrets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          secrets: [
            {
              name: "OPENAI_API_KEY",
              masked_value: "sk-***",
              created_at: "2026-06-09T12:00:00.000Z",
              updated_at: "2026-06-09T12:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.listProjectSecrets("proj-1");

    expect(result.secrets[0]?.name).toBe("OPENAI_API_KEY");
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/secrets`);
  });

  it("creates a project secret", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "DB_PASSWORD",
          masked_value: "****",
          created_at: "2026-06-09T12:00:00.000Z",
          updated_at: "2026-06-09T12:00:00.000Z",
        }),
        { status: 201 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const secret = await api.createProjectSecret(
      "proj-1",
      "DB_PASSWORD",
      "hunter2",
    );

    expect(secret.name).toBe("DB_PASSWORD");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ name: "DB_PASSWORD", value: "hunter2" }),
    );
  });

  it("deletes a project secret with encoded name", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const api = new VoicethereApi(apiKey, apiBase);
    await api.deleteProjectSecret("proj-1", "legacy/key");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/secrets/legacy%2Fkey");
    expect(init.method).toBe("DELETE");
  });

  it("deletes a session recording", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      text: async () => "",
    } as Response);

    const api = new VoicethereApi(apiKey, apiBase);
    await api.deleteSessionRecording("proj-1", "orch/session");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe(
      "/api/v1/projects/proj-1/sessions/orch%2Fsession/recording",
    );
    expect(init.method).toBe("DELETE");
  });

  it("deletes a project with force query and confirm name", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.deleteProject("proj-1", {
      force: true,
      confirmName: "Demo",
    });

    expect(result).toEqual({ mode: "completed" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.search).toBe("?force=true");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe(JSON.stringify({ confirm_name: "Demo" }));
  });

  it("returns queued delete result from 202 body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: "del-1", status: "queued" }), {
        status: 202,
      }),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.deleteProject("proj-1", { force: true });

    expect(result).toEqual({ mode: "queued", jobId: "del-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("gets project deletion job status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "del-1",
          project_id: "proj-1",
          status: "running",
          step: "wait_undeploy",
          error: null,
          created_at: "2026-01-01T00:00:00Z",
          completed_at: null,
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const job = await api.getProjectDeletionJob("proj-1", "del-1");

    expect(job.status).toBe("running");
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/deletion/del-1");
  });

  it("lists project sessions with start/end query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [
            {
              id: "db-1",
              orchestrator_session_id: "orch-1",
              status: "ended",
              build_id: null,
              created_at: "2026-06-19T00:00:00.000Z",
              ended_at: null,
              end_reason: "client_disconnected",
              billable_seconds: 12,
              expires_at: null,
            },
          ],
          start: 0,
          end: 1,
          count: 10,
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const page = await api.listProjectSessions("proj-1", {
      start: 0,
      end: 25,
    });

    expect(page.sessions).toHaveLength(1);
    expect(page.start).toBe(0);
    expect(page.end).toBe(1);
    expect(page.count).toBe(10);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.search).toBe("?start=0&end=25");
  });

  it("gets project session billing row", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "db-1",
          orchestrator_session_id: "orch-1",
          status: "ended",
          build_id: null,
          created_at: "2026-06-19T00:00:00.000Z",
          ended_at: "2026-06-19T00:01:00.000Z",
          end_reason: "client_disconnected",
          billable_seconds: 42,
          expires_at: null,
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const session = await api.getProjectSession("proj-1", "orch-1");

    expect(session.billable_seconds).toBe(42);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/api/v1/projects/proj-1/sessions/orch-1");
  });

  it("creates a deployment job", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "dep-1",
          org_id: "org-1",
          project_id: "proj-1",
          build_id: "build-1",
          status: "queued",
          mode: "drain",
          bullmq_job_id: "job-1",
          error: null,
          created_at: "2026-06-09T12:00:00.000Z",
          completed_at: null,
        }),
        { status: 201 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const job = await api.createDeployment({
      project_id: "proj-1",
      build_id: "build-1",
      mode: "force",
    });

    expect(job.id).toBe("dep-1");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/deployments`);
    expect(init.body).toBe(
      JSON.stringify({
        project_id: "proj-1",
        build_id: "build-1",
        mode: "force",
      }),
    );
  });

  it("lists subscriptions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          subscriptions: [
            {
              id: "sub-1",
              org_id: "org-1",
              project_id: null,
              tier: "free",
              price_id: "price_free",
              status: "active",
              created_at: "2026-07-01T00:00:00.000Z",
              updated_at: "2026-07-01T00:00:00.000Z",
              canceled_at: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const subscriptions = await api.listSubscriptions();

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.id).toBe("sub-1");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/subscriptions`);
    expect(init.method).toBe("GET");
  });

  it("gets project subscription assignment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          subscription: {
            id: "sub-1",
            org_id: "org-1",
            project_id: "proj-1",
            tier: "free",
            price_id: "price_free",
            status: "active",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
            canceled_at: null,
          },
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.getProjectSubscription("proj-1");

    expect(result.project_id).toBe("proj-1");
    expect(result.subscription?.id).toBe("sub-1");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/subscription`);
    expect(init.method).toBe("GET");
  });

  it("sets project subscription assignment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          subscription: { id: "sub-2" },
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.setProjectSubscription("proj-1", "sub-2");

    expect(result.subscription?.id).toBe("sub-2");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/subscription`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ subscription_id: "sub-2" }));
  });

  it("clears project subscription assignment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_id: "proj-1",
          subscription: null,
        }),
        { status: 200 },
      ),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    const result = await api.setProjectSubscription("proj-1", null);

    expect(result.subscription).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${apiBase}/projects/proj-1/subscription`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ subscription_id: null }));
  });
});
