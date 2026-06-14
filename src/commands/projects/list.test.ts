import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsList } from "./list.js";

const listProjects = vi.fn();
const requireCredentials = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ listProjects })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

describe("runProjectsList", () => {
  beforeEach(() => {
    listProjects.mockReset();
    requireCredentials.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
  });

  it("prints tab-separated project rows", async () => {
    listProjects.mockResolvedValue([
      {
        id: "proj-1",
        org_id: "org-1",
        name: "Demo",
        slug: "demo",
        active_build_id: "build-1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    await runProjectsList();

    expect(console.log).toHaveBeenCalledWith(
      "proj-1\tdemo\tDemo\tactive_build=build-1",
    );
  });

  it("prints empty message when no projects exist", async () => {
    listProjects.mockResolvedValue([]);

    await runProjectsList();

    expect(console.log).toHaveBeenCalledWith("No projects found.");
  });
});
