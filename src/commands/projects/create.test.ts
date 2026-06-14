import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsCreate } from "./create.js";

const createProject = vi.fn();
const requireCredentials = vi.fn();
const writeProjectConfig = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ createProject })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  writeProjectConfig: (...args: unknown[]) => writeProjectConfig(...args),
}));

describe("runProjectsCreate", () => {
  beforeEach(() => {
    createProject.mockReset();
    requireCredentials.mockReset();
    writeProjectConfig.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    createProject.mockResolvedValue({
      id: "proj-1",
      org_id: "org-1",
      name: "My Agent",
      slug: "my-agent",
      active_build_id: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    writeProjectConfig.mockResolvedValue("/repo/.voicethere/config.json");
  });

  it("creates a project and links local config by default", async () => {
    await runProjectsCreate({ name: "My Agent" });

    expect(createProject).toHaveBeenCalledWith("My Agent", "my-agent");
    expect(writeProjectConfig).toHaveBeenCalledWith({
      project_id: "proj-1",
      project_slug: "my-agent",
      name: "My Agent",
      bundle: undefined,
    });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"slug": "my-agent"'),
    );
  });

  it("uses explicit slug and bundle when provided", async () => {
    await runProjectsCreate({
      name: "My Agent",
      slug: "custom-slug",
      bundle: "build/out.js",
    });

    expect(createProject).toHaveBeenCalledWith("My Agent", "custom-slug");
    expect(writeProjectConfig).toHaveBeenCalledWith(
      expect.objectContaining({ bundle: "build/out.js" }),
    );
  });

  it("skips linking when --no-link is set", async () => {
    await runProjectsCreate({ name: "My Agent", link: false });

    expect(writeProjectConfig).not.toHaveBeenCalled();
  });

  it("requires a non-empty name", async () => {
    await expect(runProjectsCreate({ name: "  " })).rejects.toThrow(
      /project name is required/,
    );
    expect(createProject).not.toHaveBeenCalled();
  });
});
