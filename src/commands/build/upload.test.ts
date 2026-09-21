import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBuildUpload } from "./upload.js";
import { runBuildValidate } from "./validate.js";

const uploadBuild = vi.fn();
const requireCredentials = vi.fn();
const resolveProjectId = vi.fn();
const resolveBundlePathDetailed = vi.fn();
const assertBundleExists = vi.fn();

vi.mock("../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    uploadBuild,
  })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  resolveProjectId: (...args: unknown[]) => resolveProjectId(...args),
  resolveBundlePathDetailed: (...args: unknown[]) =>
    resolveBundlePathDetailed(...args),
  assertBundleExists: (...args: unknown[]) => assertBundleExists(...args),
}));

vi.mock("./validate.js", () => ({
  runBuildValidate: vi.fn(),
}));

describe("runBuildUpload", () => {
  let bundlePath: string;

  beforeEach(async () => {
    uploadBuild.mockReset();
    requireCredentials.mockReset();
    resolveProjectId.mockReset();
    resolveBundlePathDetailed.mockReset();
    assertBundleExists.mockReset();
    vi.mocked(runBuildValidate).mockReset();

    bundlePath = join(
      tmpdir(),
      `voicethere-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.js`,
    );
    await mkdir(tmpdir(), { recursive: true });
    await writeFile(bundlePath, "export {};\n", "utf8");

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });
    resolveProjectId.mockResolvedValue({
      projectId: "proj-1",
      source: "config",
      configPath: "/tmp/.voicethere/config.json",
    });
    resolveBundlePathDetailed.mockResolvedValue({
      absolutePath: bundlePath,
      relativePath: "dist/agent.js",
      cwd: "/tmp",
      source: "config",
    });
    assertBundleExists.mockResolvedValue(undefined);
    uploadBuild.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "proj-1",
      message: "Add Spanish greeting",
      created_at: "2026-09-21T12:00:00Z",
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a human-readable summary including the promote command", async () => {
    await runBuildUpload({ skipValidate: true });

    const stdout = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    expect(stdout).toContain(
      "Uploaded build 550e8400-e29b-41d4-a716-446655440000",
    );
    expect(stdout).toContain(
      "  voicethere build promote 550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("prints only the build UUID when printId is set", async () => {
    await runBuildUpload({ skipValidate: true, printId: true });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(vi.mocked(console.log).mock.calls[0]?.[0]).not.toMatch(/\s/);
  });

  it("still validates unless skipValidate is set, without extra stdout for printId", async () => {
    vi.mocked(runBuildValidate).mockResolvedValue(undefined);

    await runBuildUpload({ printId: true });

    expect(runBuildValidate).toHaveBeenCalledWith({
      file: undefined,
      logContext: false,
    });
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
