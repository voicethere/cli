import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBuildUpload } from "./build/upload.js";
import { runDeploy } from "./deploy.js";
import { runSourcePush } from "./source.js";

const registryError = () => {
  throw new Error("registry must not be consulted");
};

vi.mock("@voicethere/agent/templates", () => ({
  getTemplate: registryError,
  listTemplates: registryError,
  loadTemplateWorkspaceSources: registryError,
}));

const uploadBuild = vi.fn();
const getProjectSource = vi.fn();
const putProjectSource = vi.fn();
const createDeployment = vi.fn();
const getDeployment = vi.fn();
const requireCredentials = vi.fn();
const resolveBundlePathDetailed = vi.fn();
const readProjectConfig = vi.fn();

vi.mock("../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    uploadBuild,
    getProjectSource,
    putProjectSource,
    createDeployment,
    getDeployment,
  })),
}));

vi.mock("../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../lib/project-config.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/project-config.js")>();
  return {
    ...actual,
    requireProjectId: vi.fn(async () => "proj-retired"),
    resolveProjectId: vi.fn(async () => ({
      projectId: "proj-retired",
      source: "config",
      configPath: "",
    })),
    readProjectConfig: (...args: unknown[]) => readProjectConfig(...args),
    resolveBundlePathDetailed: (...args: unknown[]) =>
      resolveBundlePathDetailed(...args),
    assertBundleExists: vi.fn(async () => undefined),
  };
});

describe("project whose template was retired", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-retired-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(join(tempDir, ".voicethere"), { recursive: true });
    await mkdir(join(tempDir, "old-retired-template"), { recursive: true });
    await writeFile(
      join(tempDir, "package.json"),
      `${JSON.stringify({ name: "voicethere-old-retired-template" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(tempDir, "old-retired-template", "agent.ts"),
      "export {};\n",
      "utf8",
    );
    const bundlePath = join(tempDir, "agent.js");
    await writeFile(bundlePath, "export {};\n", "utf8");

    for (const fn of [
      uploadBuild,
      getProjectSource,
      putProjectSource,
      createDeployment,
      getDeployment,
      requireCredentials,
      resolveBundlePathDetailed,
      readProjectConfig,
    ]) {
      fn.mockReset();
    }
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });
    readProjectConfig.mockResolvedValue({
      config: { project_id: "proj-retired" },
      path: join(tempDir, ".voicethere", "config.json"),
    });
    resolveBundlePathDetailed.mockResolvedValue({
      absolutePath: bundlePath,
      relativePath: "agent.js",
      cwd: tempDir,
      source: "config",
    });
    uploadBuild.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "proj-retired",
      message: null,
      created_at: "2026-10-13T12:00:00Z",
    });
    getProjectSource.mockResolvedValue({
      project_id: "proj-retired",
      entry_path: "old-retired-template/agent.ts",
      files: [],
      revision: 3,
    });
    putProjectSource.mockResolvedValue({
      project_id: "proj-retired",
      entry_path: "old-retired-template/agent.ts",
      files: [],
      revision: 4,
    });
    createDeployment.mockResolvedValue({
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-retired",
      build_id: "build-1",
      status: "queued",
      mode: "drain",
      bullmq_job_id: "job-1",
      error: null,
      created_at: "2026-10-13T12:00:00Z",
      completed_at: null,
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("build upload works for a project whose template was retired", async () => {
    await runBuildUpload({ skipValidate: true });
    expect(uploadBuild).toHaveBeenCalled();
  });

  it("source push works for a project whose template was retired", async () => {
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await runSourcePush();
    } finally {
      process.chdir(previousCwd);
    }
    expect(putProjectSource).toHaveBeenCalledWith(
      "proj-retired",
      expect.objectContaining({
        entry_path: "old-retired-template/agent.ts",
        revision: 3,
      }),
    );
  });

  it("deploy works for a project whose template was retired", async () => {
    await runDeploy({ buildId: "build-1" });
    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-retired",
      build_id: "build-1",
      mode: "drain",
    });
  });
});
