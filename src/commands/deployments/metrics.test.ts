import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSince, runDeploymentsMetrics } from "./metrics.js";

const getDeploymentMetrics = vi.fn();

vi.mock("../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({ getDeploymentMetrics })),
}));
vi.mock("../../lib/config.js", () => ({
  requireCredentials: vi.fn(async () => ({ api_key: "k", api_base: "b" })),
}));
vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: vi.fn(async () => "proj-1"),
}));

const NOW = Date.parse("2026-10-24T12:00:00Z");
const response = {
  project_id: "proj-1",
  from: "2026-10-23T12:00:00.000Z",
  to: "2026-10-24T12:00:00.000Z",
  deployments: [
    {
      build_id: "aaaaaaaa-1111-4111-8111-111111111111",
      sessions: 80,
      failed: 4,
      failure_rate: 5,
      top_failure_keys: [{ key: "stt_timeout", count: 3 }],
      build: {
        id: "a",
        message: "stable v1",
        created_at: "2026-10-01T00:00:00Z",
      },
    },
    {
      build_id: "bbbbbbbb-2222-4222-8222-222222222222",
      sessions: 20,
      failed: 10,
      failure_rate: 50,
      top_failure_keys: [],
      build: null,
    },
  ],
};

let out: string[];
beforeEach(() => {
  getDeploymentMetrics.mockReset();
  getDeploymentMetrics.mockResolvedValue(response);
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    out.push(a.join(" "));
  });
});

describe("deployments metrics", () => {
  it("requests from/to for the --since window", async () => {
    await runDeploymentsMetrics({ since: "7d", now: () => NOW });
    expect(getDeploymentMetrics).toHaveBeenCalledWith("proj-1", {
      from: "2026-10-17T12:00:00.000Z",
      to: "2026-10-24T12:00:00.000Z",
    });
  });

  it("defaults to 24h", async () => {
    await runDeploymentsMetrics({ now: () => NOW });
    expect(getDeploymentMetrics).toHaveBeenCalledWith("proj-1", {
      from: "2026-10-23T12:00:00.000Z",
      to: "2026-10-24T12:00:00.000Z",
    });
  });

  it("prints one row per build", async () => {
    await runDeploymentsMetrics({ now: () => NOW });
    const text = out.join("\n");
    expect(text).toContain("BUILD");
    expect(text).toContain("FAILURE RATE");
    expect(text).toMatch(
      /aaaaaaaa\s+stable v1\s+80\s+4\s+5%\s+stt_timeout \(3\)/,
    );
    expect(text).toMatch(/bbbbbbbb\s+-\s+20\s+10\s+50%\s+-/);
  });

  it("--json prints the response", async () => {
    await runDeploymentsMetrics({ json: true, now: () => NOW });
    expect(JSON.parse(out.join("\n"))).toEqual(response);
  });

  it("rejects a bad --since without a request", async () => {
    await expect(runDeploymentsMetrics({ since: "soon" })).rejects.toThrow(
      /--since must look like/,
    );
    expect(getDeploymentMetrics).not.toHaveBeenCalled();
  });

  it("parseSince handles m, h and d", () => {
    expect(parseSince("30m")).toBe(1_800_000);
    expect(parseSince("24h")).toBe(86_400_000);
    expect(parseSince("2d")).toBe(172_800_000);
    expect(() => parseSince("0h")).toThrow();
  });
});
