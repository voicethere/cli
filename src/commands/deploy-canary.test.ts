import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanaryDeployFields, runDeploy } from "./deploy.js";

const createDeployment = vi.fn();
const getDeployment = vi.fn();

vi.mock("../lib/api.js", () => ({
  createApi: vi.fn(() => ({ createDeployment, getDeployment })),
}));
vi.mock("../lib/config.js", () => ({
  requireCredentials: vi.fn(async () => ({
    api_key: "vth_test",
    api_base: "https://app.voicethere.dev/api/v1",
  })),
}));
vi.mock("../lib/project-config.js", () => ({
  resolveProjectId: vi.fn(async () => ({ projectId: "proj-1" })),
}));

const BUILD = "11111111-1111-4111-8111-111111111111";

describe("deploy canary flags", () => {
  beforeEach(() => {
    createDeployment.mockReset();
    getDeployment.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    createDeployment.mockResolvedValue({
      id: "dep-1",
      build_id: BUILD,
      mode: "drain",
      status: "queued",
    });
  });

  it("sends canary_pods with defaults left to the server", async () => {
    await runDeploy({ buildId: BUILD, mode: "drain", canaryPods: "1" });
    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: BUILD,
      mode: "drain",
      canary_pods: 1,
    });
  });

  it("maps routing, context field and auto-abort flags", async () => {
    await runDeploy({
      buildId: BUILD,
      canaryPods: "2",
      routing: "customer-context",
      contextField: "tier",
      autoAbortRate: "15",
      autoAbortMinSessions: "30",
    });
    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: BUILD,
      mode: "drain",
      canary_pods: 2,
      routing_mode: "customer_context",
      routing_context_field: "tier",
      max_failure_rate_pct: 15,
      min_sessions: 30,
    });
  });

  it("maps round-robin and --no-auto-abort", async () => {
    await runDeploy({
      buildId: BUILD,
      canaryPods: "1",
      routing: "round-robin",
      autoAbort: false,
    });
    expect(createDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        routing_mode: "round_robin",
        auto_abort_enabled: false,
      }),
    );
  });

  it("does not add canary fields to a normal deploy", async () => {
    await runDeploy({ buildId: BUILD });
    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: BUILD,
      mode: "drain",
    });
  });

  it.each([
    [
      { canaryPods: "0", buildId: BUILD },
      /--canary-pods must be a whole number/,
    ],
    [
      { canaryPods: "1.5", buildId: BUILD },
      /--canary-pods must be a whole number/,
    ],
    [{ canaryPods: "1" }, /--canary-pods needs --build-id/],
    [{ canaryPods: "1", buildId: BUILD, mode: "force" as const }, /mode drain/],
    [
      { canaryPods: "1", buildId: BUILD, routing: "customer-context" },
      /--context-field is required/,
    ],
    [
      {
        canaryPods: "1",
        buildId: BUILD,
        routing: "round-robin",
        contextField: "x",
      },
      /only be used with --routing customer-context/,
    ],
    [
      { canaryPods: "1", buildId: BUILD, contextField: "x" },
      /only be used with --routing customer-context/,
    ],
    [
      { canaryPods: "1", buildId: BUILD, routing: "random" },
      /Invalid --routing/,
    ],
    [{ canaryPods: "1", buildId: BUILD, autoAbortRate: "0" }, /greater than 0/],
    [{ canaryPods: "1", buildId: BUILD, autoAbortRate: "101" }, /at most 100/],
    [
      { canaryPods: "1", buildId: BUILD, autoAbortMinSessions: "0" },
      /whole number of 1 or more/,
    ],
    [
      {
        canaryPods: "1",
        buildId: BUILD,
        autoAbort: false,
        autoAbortRate: "10",
      },
      /cannot be combined/,
    ],
    [{ buildId: BUILD, routing: "round-robin" }, /need --canary-pods/],
    [{ buildId: BUILD, autoAbort: false }, /need --canary-pods/],
  ])("rejects %j before any request", async (options, message) => {
    await expect(runDeploy(options)).rejects.toThrow(message);
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("buildCanaryDeployFields returns nothing without canary flags", () => {
    expect(buildCanaryDeployFields({ buildId: BUILD })).toEqual({});
  });
});
