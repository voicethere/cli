import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, VoicethereApi } from "./api.js";
import {
  DEFAULT_API_BASE,
  getCredentialsPath,
  readCredentials,
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
  });

  afterEach(async () => {
    delete process.env.VOICETHERE_CREDENTIALS_PATH;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uses override path from VOICETHERE_CREDENTIALS_PATH", () => {
    expect(getCredentialsPath()).toBe(credentialsPath);
  });

  it("defaults api_base to production URL", () => {
    expect(DEFAULT_API_BASE).toBe("https://app.voicethere.dev/api/v1");
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
});

describe("slugifyName", () => {
  it("lowercases and hyphenates names", () => {
    expect(slugifyName("My Voice Agent")).toBe("my-voice-agent");
  });

  it("strips leading and trailing punctuation", () => {
    expect(slugifyName("  --Hello World!!  ")).toBe("hello-world");
  });
});

describe("VoicethereApi", () => {
  const apiKey = "vth_dev_test";
  const apiBase = "https://app.voicethere.dev/api/v1";

  afterEach(() => {
    vi.restoreAllMocks();
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
    } satisfies Partial<ApiError>);
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
});
