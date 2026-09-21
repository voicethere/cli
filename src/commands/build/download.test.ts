import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api.js";
import { resolveDefaultBuildDownloadId, runBuildDownload } from "./download.js";

const getProject = vi.fn();
const listBuilds = vi.fn();
const getProjectBuildDownload = vi.fn();
const requireCredentials = vi.fn();

vi.mock("../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    getProject,
    listBuilds,
    getProjectBuildDownload,
  })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/project-config.js")>();
  return {
    ...actual,
    resolveProjectId: vi.fn(async () => ({
      projectId: "proj-dl",
      source: "config",
      configPath: "",
    })),
  };
});

describe("build download", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-build-dl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });

    getProject.mockReset();
    listBuilds.mockReset();
    getProjectBuildDownload.mockReset();
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uses explicit project id when provided with --build-id", async () => {
    const { resolveProjectId } = await import("../../lib/project-config.js");
    const js = Buffer.from("export default {};\n");
    getProjectBuildDownload.mockResolvedValue({
      bytes: js,
      filename: "demo.js",
    });

    const outPath = join(tempDir, "agent.js");
    await runBuildDownload({
      output: outPath,
      projectId: "proj-explicit",
      buildId: "b-explicit",
    });

    expect(resolveProjectId).not.toHaveBeenCalled();
    expect(getProjectBuildDownload).toHaveBeenCalledWith(
      "proj-explicit",
      "b-explicit",
    );
    expect(getProject).not.toHaveBeenCalled();
    expect(await readFile(outPath)).toEqual(js);
  });

  it("writes bundle bytes for an explicit build id", async () => {
    const js = Buffer.from("export default {};\n");
    getProjectBuildDownload.mockResolvedValue({
      bytes: js,
      filename: "demo-build-b1.js",
    });

    const outPath = join(tempDir, "agent.js");
    await runBuildDownload({ output: outPath, buildId: "b1" });

    expect(getProjectBuildDownload).toHaveBeenCalledWith("proj-dl", "b1");
    expect(getProject).not.toHaveBeenCalled();
    expect(await readFile(outPath)).toEqual(js);
  });

  it("defaults to active_build_id when --build-id is omitted", async () => {
    getProject.mockResolvedValue({ active_build_id: "active-1" });
    listBuilds.mockResolvedValue([
      {
        id: "newer-failed",
        validation_status: "failed",
        created_at: "2026-09-21T12:00:00.000Z",
      },
    ]);
    getProjectBuildDownload.mockResolvedValue({
      bytes: Buffer.from("active"),
      filename: null,
    });

    const outPath = join(tempDir, "bundle.js");
    await runBuildDownload({ output: outPath });

    expect(getProjectBuildDownload).toHaveBeenCalledWith("proj-dl", "active-1");
  });

  it("falls back to newest passed build when no active build", async () => {
    getProject.mockResolvedValue({ active_build_id: null });
    listBuilds.mockResolvedValue([
      {
        id: "build-new",
        validation_status: "passed",
        created_at: "2026-09-21T12:00:00.000Z",
      },
      {
        id: "build-old",
        validation_status: "passed",
        created_at: "2026-09-20T12:00:00.000Z",
      },
    ]);
    getProjectBuildDownload.mockResolvedValue({
      bytes: Buffer.from("passed"),
      filename: null,
    });

    const outPath = join(tempDir, "bundle.js");
    await runBuildDownload({ output: outPath });

    expect(getProjectBuildDownload).toHaveBeenCalledWith(
      "proj-dl",
      "build-new",
    );
  });

  it("resolveDefaultBuildDownloadId errors when no active or passed build", async () => {
    const { createApiFromCredentials } =
      await import("../../lib/control-plane-auth.js");
    const api = createApiFromCredentials({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });
    getProject.mockResolvedValue({ active_build_id: null });
    listBuilds.mockResolvedValue([
      {
        id: "build-pending",
        validation_status: "pending",
        created_at: "2026-09-21T12:00:00.000Z",
      },
    ]);

    await expect(resolveDefaultBuildDownloadId(api, "proj-dl")).rejects.toThrow(
      /No build available/,
    );
  });

  it("surfaces ApiError on 404 from download API", async () => {
    getProjectBuildDownload.mockRejectedValue(
      new ApiError(404, "Build not found"),
    );

    const outPath = join(tempDir, "bundle.js");
    await expect(
      runBuildDownload({ output: outPath, buildId: "missing" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
