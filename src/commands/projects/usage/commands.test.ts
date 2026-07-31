import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsUsageShow } from "./show.js";

const getProjectUsage = vi.fn();
const getOrgUsage = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    getProjectUsage,
    getOrgUsage,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects usage command", () => {
  beforeEach(() => {
    getProjectUsage.mockReset();
    getOrgUsage.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("prints project usage JSON", async () => {
    getProjectUsage.mockResolvedValue({
      org_id: "org-1",
      project_id: "proj-1",
      total_credits: 3.3,
      totals: [],
      series: [],
      balance: null,
    });

    await runProjectsUsageShow({ period: "30d" });

    expect(getProjectUsage).toHaveBeenCalledWith("proj-1", { period: "30d" });
    expect(console.log).toHaveBeenCalled();
  });

  it("prints org usage when --org is set", async () => {
    getOrgUsage.mockResolvedValue({
      org_id: "org-1",
      project_ids: ["proj-1"],
      total_credits: 0,
      totals: [],
      series: [],
      balance: null,
    });

    await runProjectsUsageShow({ org: true, period: "utc_month" });

    expect(getOrgUsage).toHaveBeenCalledWith({ period: "utc_month" });
    expect(getProjectUsage).not.toHaveBeenCalled();
  });
});
