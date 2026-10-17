import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseLimitFlag, runDeploymentsList } from "./list.js";

const listProjectDeployments = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ listProjectDeployments })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const summary = {
  id: "11111111-aaaa-4bbb-8ccc-000000000001",
  build_id: "a1b2c3d4-0000-4000-8000-000000000000",
  mode: "drain",
  status: "completed",
  error: null,
  created_at: "2026-10-17T12:00:00.000Z",
  completed_at: "2026-10-17T12:02:05.000Z",
  last_event_at: "2026-10-17T12:09:30.000Z",
  event_count: 6,
};

describe("parseLimitFlag", () => {
  it("defaults to 20 and accepts 1 to 50", () => {
    expect(parseLimitFlag(undefined)).toBe(20);
    expect(parseLimitFlag(1)).toBe(1);
    expect(parseLimitFlag(50)).toBe(50);
  });

  it.each([0, 51, -1, 2.5, Number.NaN])("rejects %s", (value) => {
    expect(() => parseLimitFlag(value)).toThrow(/--limit must be/);
  });
});

describe("runDeploymentsList", () => {
  beforeEach(() => {
    listProjectDeployments.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
    listProjectDeployments.mockResolvedValue({
      deployments: [summary],
      next_before: "2026-10-17T12:00:00.000Z",
    });
  });

  it("uses the linked project and the default limit", async () => {
    await runDeploymentsList({});

    expect(listProjectDeployments).toHaveBeenCalledWith("proj-1", {
      limit: 20,
    });
    expect(console.log).toHaveBeenCalledWith(
      "2026-10-17 12:00:00  a1b2c3d4  drain  completed  2:05      2026-10-17 12:09:30",
    );
    expect(console.log).toHaveBeenCalledWith(
      "next: --before 2026-10-17T12:00:00.000Z",
    );
  });

  it("passes project, limit and before to the API", async () => {
    await runDeploymentsList({
      projectId: " proj-9 ",
      limit: 5,
      before: "2026-10-17T12:00:00Z",
    });

    expect(requireProjectId).not.toHaveBeenCalled();
    expect(listProjectDeployments).toHaveBeenCalledWith("proj-9", {
      limit: 5,
      before: "2026-10-17T12:00:00Z",
    });
  });

  it("rejects a bad --before before calling the API", async () => {
    await expect(
      runDeploymentsList({ before: "yesterday" }),
    ).rejects.toThrow(/--before must be an ISO 8601 timestamp/);
    expect(listProjectDeployments).not.toHaveBeenCalled();
  });

  it("rejects a limit out of range before calling the API", async () => {
    await expect(runDeploymentsList({ limit: 100 })).rejects.toThrow(
      /--limit must be/,
    );
    expect(listProjectDeployments).not.toHaveBeenCalled();
  });

  it("passes the API response through with --json", async () => {
    const response = { deployments: [summary], next_before: null };
    listProjectDeployments.mockResolvedValue(response);

    await runDeploymentsList({ json: true });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(response, null, 2));
  });
});
