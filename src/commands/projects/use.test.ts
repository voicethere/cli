import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsUse } from "./use.js";

const getProject = vi.fn();
const listProjects = vi.fn();
const requireCredentials = vi.fn();
const readProjectConfig = vi.fn();
const writeProjectConfig = vi.fn();
const promptChoice = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ getProject, listProjects })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  readProjectConfig: (...args: unknown[]) => readProjectConfig(...args),
  writeProjectConfig: (...args: unknown[]) => writeProjectConfig(...args),
}));

vi.mock("../../lib/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
  promptChoice: (...args: unknown[]) => promptChoice(...args),
}));

describe("runProjectsUse", () => {
  beforeEach(() => {
    getProject.mockReset();
    listProjects.mockReset();
    requireCredentials.mockReset();
    readProjectConfig.mockReset();
    writeProjectConfig.mockReset();
    promptChoice.mockReset();

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    getProject.mockResolvedValue({
      id: "proj-1",
      org_id: "org-1",
      name: "Demo",
      slug: "demo",
      active_build_id: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    writeProjectConfig.mockResolvedValue("/repo/.voicethere/config.json");
  });

  it("uses existing local config when project id is omitted", async () => {
    readProjectConfig.mockResolvedValue({
      path: "/repo/.voicethere/config.json",
      config: {
        project_id: "proj-1",
        project_slug: "demo",
        name: "Demo",
        bundle: "dist/agent.js",
      },
    });

    await runProjectsUse({});

    expect(getProject).toHaveBeenCalledWith("proj-1");
    expect(listProjects).not.toHaveBeenCalled();
    expect(writeProjectConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "proj-1",
        bundle: "dist/agent.js",
      }),
      expect.objectContaining({ path: "/repo/.voicethere/config.json" }),
    );
  });

  it("uses explicit project id over local config", async () => {
    readProjectConfig.mockResolvedValue({
      path: "/repo/.voicethere/config.json",
      config: { project_id: "proj-old" },
    });

    await runProjectsUse({ projectId: "proj-1" });

    expect(getProject).toHaveBeenCalledWith("proj-1");
    expect(writeProjectConfig).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "proj-1" }),
      expect.objectContaining({ path: undefined }),
    );
  });

  it("requires project id in non-interactive mode when no local config", async () => {
    readProjectConfig.mockResolvedValue(null);

    await expect(runProjectsUse({})).rejects.toThrow(
      /No .voicethere\/config.json found/,
    );
    expect(listProjects).not.toHaveBeenCalled();
  });
});
