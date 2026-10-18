import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeployFailureReported, parseDeployMode, runDeploy } from "./deploy.js";

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

  it("includes capacity error when --wait times out with queued job error", async () => {
    vi.useFakeTimers();

    getDeployment.mockResolvedValue({
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status: "queued",
      mode: "drain",
      bullmq_job_id: "job-1",
      error:
        "CLUSTER_NO_CAPACITY: deploy_admission cpu_deficit=255m memory_deficit=0",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: null,
    });

    const promise = runDeploy({
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });
    const rejection = expect(promise).rejects.toThrow(/CLUSTER_NO_CAPACITY/);
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
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

describe("parseDeployMode", () => {
  it("defaults to drain", () => {
    expect(parseDeployMode(undefined)).toBe("drain");
    expect(parseDeployMode("")).toBe("drain");
    expect(parseDeployMode("drain")).toBe("drain");
  });

  it("accepts force, trimming surrounding spaces", () => {
    expect(parseDeployMode("force")).toBe("force");
    expect(parseDeployMode(" force ")).toBe("force");
  });

  it("rejects anything else", () => {
    expect(() => parseDeployMode("Force")).toThrow(
      'Invalid --mode "Force". Use drain or force.',
    );
    expect(() => parseDeployMode("bogus")).toThrow(
      'Invalid --mode "bogus". Use drain or force.',
    );
  });
});

describe("runDeploy mode", () => {
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
  });

  function job(status: string, mode: string) {
    return {
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status,
      mode,
      bullmq_job_id: "job-1",
      error: null,
      created_at: "2026-01-01T00:00:00Z",
      completed_at: status === "completed" ? "2026-01-01T00:01:00Z" : null,
    };
  }

  it("sends mode force and polls to completed", async () => {
    createDeployment.mockResolvedValue(job("queued", "force"));
    getDeployment
      .mockResolvedValueOnce(job("active", "force"))
      .mockResolvedValueOnce(job("completed", "force"));

    await runDeploy({ mode: "force", wait: true, pollIntervalMs: 1 });

    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: undefined,
      mode: "force",
    });
    expect(getDeployment).toHaveBeenCalledWith("dep-1");
    expect(console.log).toHaveBeenCalledWith("Deployment completed: dep-1");
    expect(console.log).toHaveBeenCalledWith("  mode: force");
  });

  it("sends mode drain when no mode is given", async () => {
    createDeployment.mockResolvedValue(job("queued", "drain"));

    await runDeploy({});

    expect(createDeployment).toHaveBeenCalledWith({
      project_id: "proj-1",
      build_id: undefined,
      mode: "drain",
    });
  });
});

describe("runDeploy failure output", () => {
  const RAW_ERROR = "permanent error: AGENT_START_FAILED: runner-abc pod";

  function failedJob(overrides: Record<string, unknown> = {}) {
    return {
      id: "dep-1",
      org_id: "org-1",
      project_id: "proj-1",
      build_id: "build-1",
      status: "failed",
      mode: "drain",
      bullmq_job_id: "job-1",
      error: RAW_ERROR,
      created_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
      trace_id: "trace-123",
      ...overrides,
    };
  }

  function activeJob(failure: unknown) {
    return {
      ...failedJob({ status: "active", error: null, completed_at: null }),
      failure,
    };
  }

  const customerFailure = {
    class: "customer",
    code: "AGENT_START_FAILED",
    message: "Your agent threw an error while it was loading.",
    retrying: false,
    attempt: null,
    max_attempts: null,
    support_email: null,
  };

  const platformFailure = {
    class: "platform",
    code: "CLUSTER_CAPACITY",
    message:
      "We don't have enough capacity to start your new version right now.",
    retrying: false,
    attempt: null,
    max_attempts: null,
    support_email: "support@voicethere.io",
  };

  function stderrLines(): string[] {
    // Skip the "[voicethere] ..." progress lines the command logs on stderr.
    return vi
      .mocked(console.error)
      .mock.calls.map((call) => String(call[0]))
      .filter((line) => !line.startsWith("[voicethere"));
  }

  beforeEach(() => {
    createDeployment.mockReset();
    getDeployment.mockReset();
    requireCredentials.mockReset();
    resolveProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
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
      ...failedJob({ status: "queued", error: null, completed_at: null }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("customer failure prints the message and the logs command, then fails quietly", async () => {
    getDeployment.mockResolvedValue(failedJob({ failure: customerFailure }));

    const error = await runDeploy({
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DeployFailureReported);
    expect(stderrLines()).toEqual([
      "Deploy failed: Your agent threw an error while it was loading.",
      "Fix your agent and deploy again. Agent logs: voicethere projects logs list --project proj-1",
    ]);
    expect((error as Error).message).not.toContain("runner-abc");
  });

  it("platform failure prints the support email and the id block", async () => {
    getDeployment.mockResolvedValue(failedJob({ failure: platformFailure }));

    await expect(
      runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }),
    ).rejects.toBeInstanceOf(DeployFailureReported);

    expect(stderrLines()).toEqual([
      "Deploy failed: We don't have enough capacity to start your new version right now.",
      "This one is on our side. Email support@voicethere.io with these details:",
      "  Deployment: dep-1",
      "  Project: proj-1",
      "  Build: build-1",
      "  Code: CLUSTER_CAPACITY",
      "  Trace id: trace-123",
      "  Failed at (UTC): 2026-01-01T00:01:00.000Z",
    ]);
  });

  it("platform failure without a support email asks to contact support", async () => {
    getDeployment.mockResolvedValue(
      failedJob({
        failure: { ...platformFailure, support_email: null },
        trace_id: null,
        completed_at: null,
        build_id: "",
      }),
    );

    await expect(
      runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }),
    ).rejects.toBeInstanceOf(DeployFailureReported);

    expect(stderrLines()).toEqual([
      "Deploy failed: We don't have enough capacity to start your new version right now.",
      "This one is on our side. Contact support with these details:",
      "  Deployment: dep-1",
      "  Project: proj-1",
      "  Build: none",
      "  Code: CLUSTER_CAPACITY",
      "  Trace id: none",
      "  Failed at (UTC): unknown",
    ]);
  });

  it("never prints the raw server error when a failure is present", async () => {
    getDeployment.mockResolvedValue(failedJob({ failure: customerFailure }));
    await runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }).catch(
      () => {},
    );
    getDeployment.mockResolvedValue(failedJob({ failure: platformFailure }));
    await runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }).catch(
      () => {},
    );

    const everything = [
      ...stderrLines(),
      ...vi.mocked(console.log).mock.calls.map((call) => String(call[0])),
    ].join("\n");
    expect(everything).not.toContain("runner-abc");
    expect(everything).not.toContain("permanent error");
  });

  it("prints a retry line once per attempt while the server retries", async () => {
    const retrying = (attempt: number) =>
      activeJob({
        class: "transient",
        code: "CLUSTER_CAPACITY",
        message: "Retrying automatically.",
        retrying: true,
        attempt,
        max_attempts: 3,
        support_email: null,
      });
    getDeployment
      .mockResolvedValueOnce(retrying(2))
      .mockResolvedValueOnce(retrying(2))
      .mockResolvedValueOnce(retrying(3))
      .mockResolvedValueOnce({
        ...failedJob({ error: null }),
        status: "completed",
      });

    await runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 });

    expect(stderrLines()).toEqual([
      "Retrying automatically (attempt 2 of 3): Retrying automatically.",
      "Retrying automatically (attempt 3 of 3): Retrying automatically.",
    ]);
  });

  it("omits the attempt part when the attempt is not known", async () => {
    getDeployment
      .mockResolvedValueOnce(
        activeJob({
          class: "transient",
          code: "READY_TIMEOUT",
          message: "Your new version didn't become ready in time.",
          retrying: true,
          attempt: null,
          max_attempts: null,
          support_email: null,
        }),
      )
      .mockResolvedValueOnce({
        ...failedJob({ error: null }),
        status: "completed",
      });

    await runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 });

    expect(stderrLines()).toEqual([
      "Retrying automatically: Your new version didn't become ready in time.",
    ]);
  });

  it("keeps the old behaviour when an older server sends no failure", async () => {
    getDeployment.mockResolvedValue(failedJob({ error: "rollout crashed" }));

    await expect(
      runDeploy({ wait: true, pollIntervalMs: 1, timeoutMs: 5_000 }),
    ).rejects.toThrow("rollout crashed");
    expect(stderrLines()).toEqual([]);
  });
});
