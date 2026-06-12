import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBuildPromote } from "./promote.js";

const promote = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ promote })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("runBuildPromote", () => {
  beforeEach(() => {
    promote.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
    promote.mockResolvedValue({
      project_id: "proj-1",
      active_build_id: "build-1",
      active_storage_path: "orgs/x/projects/y/builds/build-1/bundle.js",
    });
  });

  it("requires a non-empty build id", async () => {
    await expect(runBuildPromote({ buildId: "   " })).rejects.toThrow(
      /Build ID is required/,
    );
    expect(promote).not.toHaveBeenCalled();
  });

  it("promotes the given build id", async () => {
    await runBuildPromote({ buildId: "  build-1  " });

    expect(promote).toHaveBeenCalledWith("proj-1", "build-1");
  });
});
