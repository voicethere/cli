import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeploymentsShow } from "./show.js";

const getDeploymentEvents = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ getDeploymentEvents })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const deployment = {
  id: "22222222-aaaa-4bbb-8ccc-000000000002",
  build_id: "e5f6a7b8-0000-4000-8000-000000000000",
  mode: "force",
  status: "completed",
  error: null,
  created_at: "2026-10-17T10:30:00.000Z",
  completed_at: "2026-10-17T10:30:42.000Z",
  last_event_at: "2026-10-17T10:30:42.000Z",
  event_count: 2,
};

const events = [
  {
    id: "ev-1",
    type: "requested",
    occurred_at: "2026-10-17T10:30:00.000Z",
    details: {},
  },
  {
    id: "ev-2",
    type: "completed",
    occurred_at: "2026-10-17T10:30:42.000Z",
    details: {},
  },
];

describe("runDeploymentsShow", () => {
  beforeEach(() => {
    getDeploymentEvents.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("prints the header, one line per event, and the derived note", async () => {
    getDeploymentEvents.mockResolvedValue({ deployment, events, derived: true });

    await runDeploymentsShow(deployment.id);

    expect(getDeploymentEvents).toHaveBeenCalledWith("proj-1", deployment.id);
    expect(vi.mocked(console.log).mock.calls.map((call) => call[0])).toEqual([
      "22222222-aaaa-4bbb-8ccc-000000000002  build e5f6a7b8  force  completed  started 2026-10-17 10:30:00 UTC",
      "10:30:00 UTC  +0:00  Deploy requested",
      "10:30:42 UTC  +0:42  Deploy finished",
      "(start and end only)",
    ]);
  });

  it("omits the derived note for a stored timeline", async () => {
    getDeploymentEvents.mockResolvedValue({
      deployment,
      events,
      derived: false,
    });

    await runDeploymentsShow(deployment.id);

    const printed = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    expect(printed).not.toContain("(start and end only)");
  });

  it("uses --project over the linked project", async () => {
    getDeploymentEvents.mockResolvedValue({ deployment, events, derived: false });

    await runDeploymentsShow(deployment.id, { projectId: "proj-9" });

    expect(requireProjectId).not.toHaveBeenCalled();
    expect(getDeploymentEvents).toHaveBeenCalledWith("proj-9", deployment.id);
  });

  it("passes the API response through with --json", async () => {
    const response = { deployment, events, derived: false };
    getDeploymentEvents.mockResolvedValue(response);

    await runDeploymentsShow(deployment.id, { json: true });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(response, null, 2));
  });

  it("keeps requested_by in the --json output", async () => {
    const response = {
      deployment: {
        ...deployment,
        requested_by: { kind: "user", label: "alice@example.com" },
      },
      events,
      derived: false,
    };
    getDeploymentEvents.mockResolvedValue(response);

    await runDeploymentsShow(deployment.id, { json: true });

    const printed = JSON.parse(
      String(vi.mocked(console.log).mock.calls[0]?.[0]),
    );
    expect(printed.deployment.requested_by).toEqual({
      kind: "user",
      label: "alice@example.com",
    });
  });

  it("prints Requested by as line 2 when the server sends it", async () => {
    getDeploymentEvents.mockResolvedValue({
      deployment: {
        ...deployment,
        requested_by: { kind: "user", label: "alice@example.com" },
      },
      events,
      derived: false,
    });

    await runDeploymentsShow(deployment.id);

    const printed = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    expect(printed[1]).toBe("Requested by: alice@example.com");
  });

  it("prints the Failure line right after the header when the deploy has a failure", async () => {
    getDeploymentEvents.mockResolvedValue({
      deployment: {
        ...deployment,
        status: "failed",
        failure: {
          class: "platform",
          code: "CLUSTER_CAPACITY",
          message: "We don't have enough capacity right now.",
          retrying: false,
          attempt: null,
          max_attempts: null,
          support_email: "support@voicethere.io",
        },
      },
      events,
      derived: false,
    });

    await runDeploymentsShow(deployment.id);

    const printed = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    expect(printed[1]).toBe(
      "Failure: on our side CLUSTER_CAPACITY: We don't have enough capacity right now.",
    );
  });

  it("requires a deployment id", async () => {
    await expect(runDeploymentsShow("  ")).rejects.toThrow(
      /deploymentId is required/,
    );
    expect(getDeploymentEvents).not.toHaveBeenCalled();
  });
});
