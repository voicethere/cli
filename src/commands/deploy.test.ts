import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeploy } from "./deploy.js";

const createDeployment = vi.fn();
const getDeployment = vi.fn();
const requireCredentials = vi.fn();
const resolveProjectId = vi.fn();

vi.mock("../lib/api.js", () => ({
  createApi: vi.fn(() => ({ createDeployment, getDeployment })),
}));

vi.mock("../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../lib/project-config.js", () => ({
  resolveProjectId: (...args: unknown[]) => resolveProjectId(...args),
}));

describe("runDeploy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    createDeployment.mockReset();
    getDeployment.mockReset();
    requireCredentials.mockReset();
    resolveProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    resolveProjectId.mockResolvedValue({
      projectId: "proj-1",
      source: "config",
      configPath: "/repo/.voicethere/config.json",
    });
    createDeployment.mockResolvedValue({
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status: "queued",
      mode: "drain",
      bullmq_job_id: "job-1",
      error: null,
      created_at: "2026-01-01T00:00:00Z",
      completed_at: null,
    });
  });

  it("queues a deployment without waiting by default", async () => {
    await runDeploy({ buildId: "build-1" });

    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: "build-1",
      mode: "drain",
    });
    expect(getDeployment).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("Deployment queued: dep-1");
  });

  it("polls until deployment completes when --wait is set", async () => {
    getDeployment
      .mockResolvedValueOnce({
        id: "dep-1",
        org_id: "org-1",
        project_id: "proj-1",
        build_id: "build-1",
        status: "active",
        mode: "drain",
        bullmq_job_id: "job-1",
        error: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: null,
      })
      .mockResolvedValueOnce({
        id: "dep-1",
        org_id: "org-1",
        project_id: "proj-1",
        build_id: "build-1",
        status: "completed",
        mode: "drain",
        bullmq_job_id: "job-1",
        error: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:01:00Z",
      });

    await runDeploy({
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    expect(getDeployment).toHaveBeenCalledWith("dep-1");
    expect(console.log).toHaveBeenCalledWith("Deployment completed: dep-1");
  });

  it("includes last queued status when --wait times out", async () => {
    vi.useFakeTimers();

    getDeployment.mockResolvedValue({
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status: "queued",
      mode: "drain",
      bullmq_job_id: "job-1",
      error: null,
      created_at: "2026-01-01T00:00:00Z",
      completed_at: null,
    });

    const promise = runDeploy({
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });
    const rejection = expect(promise).rejects.toThrow(/last status=queued/);
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
  });

  it("throws when deployment fails after wait", async () => {
    getDeployment.mockResolvedValue({
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status: "failed",
      mode: "drain",
      bullmq_job_id: "job-1",
      error: "rollout crashed",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
    });

    await expect(
      runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }),
    ).rejects.toThrow(/rollout crashed/);
  });

  it("uses explicit project id when provided", async () => {
    await runDeploy({ projectId: "proj-2" });

    expect(resolveProjectId).not.toHaveBeenCalled();
    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-2",
      build_id: undefined,
      mode: "drain",
    });
  });
});
