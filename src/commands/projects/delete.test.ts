import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsDelete } from "./delete.js";

const deleteProject = vi.fn();
const getProject = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();
const readProjectConfig = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ deleteProject, getProject })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  readProjectConfig: (...args: unknown[]) => readProjectConfig(...args),
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

vi.mock("../../lib/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
  promptConfirmText: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  unlink: vi.fn(),
}));

describe("runProjectsDelete", () => {
  beforeEach(() => {
    deleteProject.mockReset();
    getProject.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    readProjectConfig.mockReset();

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
    getProject.mockResolvedValue({
      id: "proj-1",
      org_id: "org-1",
      name: "Demo",
      slug: "demo",
      active_build_id: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    readProjectConfig.mockResolvedValue(null);
  });

  it("refuses deletion in non-interactive mode without --force", async () => {
    await expect(runProjectsDelete({})).rejects.toThrow(
      /Refusing to delete "Demo" without confirmation/,
    );
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it("deletes with --force in non-interactive mode", async () => {
    await runProjectsDelete({ force: true });

    expect(deleteProject).toHaveBeenCalledWith("proj-1", {
      force: true,
      confirmName: undefined,
    });
  });

  it("uses explicit project id over linked config", async () => {
    await runProjectsDelete({ projectId: "proj-2", force: true });

    expect(requireProjectId).not.toHaveBeenCalled();
    expect(getProject).toHaveBeenCalledWith("proj-2");
    expect(deleteProject).toHaveBeenCalledWith("proj-2", {
      force: true,
      confirmName: undefined,
    });
  });
});
