import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBuildPromote } from "./promote.js";

const promote = vi.fn();
const getProject = vi.fn();
const listBuilds = vi.fn();
const requireCredentials = vi.fn();
const resolveProjectId = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ promote, getProject, listBuilds })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  resolveProjectId: (...args: unknown[]) => resolveProjectId(...args),
}));

vi.mock("../../lib/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
  promptChoice: vi.fn(),
}));

describe("runBuildPromote", () => {
  beforeEach(() => {
    promote.mockReset();
    getProject.mockReset();
    listBuilds.mockReset();
    requireCredentials.mockReset();
    resolveProjectId.mockReset();
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    resolveProjectId.mockResolvedValue({
      projectId: "proj-1",
      source: "config",
      configPath: "/tmp/.voicethere/config.json",
    });
    promote.mockResolvedValue({
      project_id: "proj-1",
      active_build_id: "build-1",
      active_storage_path: "orgs/x/projects/y/builds/build-1/bundle.js",
    });
  });

  it("requires build id in non-interactive mode when omitted", async () => {
    getProject.mockResolvedValue({ active_build_id: null });
    listBuilds.mockResolvedValue([
      {
        id: "build-1",
        project_id: "proj-1",
        size_bytes: 1,
        checksum_sha256: "abc",
        validation_status: "passed",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    await expect(runBuildPromote({})).rejects.toThrow(
      /Build id required in non-interactive mode/,
    );
    expect(promote).not.toHaveBeenCalled();
  });

  it("promotes the given build id", async () => {
    await runBuildPromote({ buildId: "  build-1  " });

    expect(promote).toHaveBeenCalledWith("proj-1", "build-1");
  });
});
