import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runCanaryAbort,
  runCanaryAutoAbort,
  runCanaryPromote,
  runCanarySet,
  runCanaryStatus,
} from "./commands.js";

const api = {
  getCanary: vi.fn(),
  patchCanary: vi.fn(),
  promoteCanary: vi.fn(),
  abortCanary: vi.fn(),
};
const isInteractive = vi.fn(() => false);
const promptYesNo = vi.fn();

vi.mock("../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => api),
}));
vi.mock("../../lib/config.js", () => ({
  requireCredentials: vi.fn(async () => ({ api_key: "k", api_base: "b" })),
}));
vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: vi.fn(async () => "proj-1"),
}));
vi.mock("../../lib/prompt.js", () => ({
  isInteractive: () => isInteractive(),
  promptYesNo: (...a: unknown[]) => promptYesNo(...a),
}));

const view = {
  id: "c1",
  status: "active",
  stable_build_id: "stable-build",
  canary_build_id: "canary-build",
  canary_pods: 1,
  plan_max_pods: 3,
  traffic_share_pct: 33.33,
  auto_abort_enabled: true,
  max_failure_rate_pct: 20,
  min_sessions: 25,
  routing_mode: "customer_context",
  routing_context_field: "tier",
  started_at: "2026-10-24T10:00:00Z",
  ended_at: null,
  end_reason: null,
};

let out: string[];

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  isInteractive.mockReturnValue(false);
  promptYesNo.mockReset();
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    out.push(a.join(" "));
  });
  api.patchCanary.mockResolvedValue({ canary: view });
  api.promoteCanary.mockResolvedValue({
    promoted: true,
    already_done: false,
    canary: view,
  });
  api.abortCanary.mockResolvedValue({
    aborted: true,
    already_done: false,
    canary: view,
  });
});

describe("canary status", () => {
  it("prints every field", async () => {
    api.getCanary.mockResolvedValue({
      canary: view,
      live: null,
      plan_max_pods: 3,
      pod_options: [1, 2],
    });
    await runCanaryStatus({});
    const text = out.join("\n");
    for (const expected of [
      "stable-build",
      "canary-build",
      "1 of 3",
      "33.33%",
      "customer-context (field: tier)",
      "on (abort above 20% failures, after 25 sessions)",
      "active",
      "2026-10-24T10:00:00Z",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("prints auto-abort off and round-robin", async () => {
    api.getCanary.mockResolvedValue({
      canary: {
        ...view,
        auto_abort_enabled: false,
        routing_mode: "round_robin",
        routing_context_field: null,
      },
      live: null,
      plan_max_pods: 3,
      pod_options: [],
    });
    await runCanaryStatus({});
    const text = out.join("\n");
    expect(text).toContain("round-robin");
    expect(text).toContain("off (rate 20%, min sessions 25)");
  });

  it("--json prints the response", async () => {
    const response = {
      canary: view,
      live: null,
      plan_max_pods: 3,
      pod_options: [1],
    };
    api.getCanary.mockResolvedValue(response);
    await runCanaryStatus({ json: true });
    expect(JSON.parse(out.join("\n"))).toEqual(response);
  });

  it("says so when there is no canary", async () => {
    api.getCanary.mockResolvedValue({
      canary: null,
      live: null,
      plan_max_pods: 3,
      pod_options: [],
    });
    await runCanaryStatus({});
    expect(out.join("\n")).toContain("No canary deployment");
  });
});

describe("canary set", () => {
  it("PATCHes pods and routing", async () => {
    await runCanarySet({
      pods: "2",
      routing: "customer-context",
      contextField: "tier",
    });
    expect(api.patchCanary).toHaveBeenCalledWith("proj-1", {
      canary_pods: 2,
      routing_mode: "customer_context",
      routing_context_field: "tier",
    });
  });

  it.each([
    [{}, /Provide --pods or --routing/],
    [{ pods: "x" }, /--canary-pods must be/],
    [{ routing: "customer-context" }, /--context-field is required/],
    [{ pods: "1", contextField: "a" }, /only be used with/],
  ])("rejects %j without a request", async (options, message) => {
    await expect(runCanarySet(options)).rejects.toThrow(message);
    expect(api.patchCanary).not.toHaveBeenCalled();
  });
});

describe("canary auto-abort", () => {
  it("sets rate and min sessions", async () => {
    await runCanaryAutoAbort({ rate: "12.5", minSessions: "40" });
    expect(api.patchCanary).toHaveBeenCalledWith("proj-1", {
      auto_abort_enabled: true,
      max_failure_rate_pct: 12.5,
      min_sessions: 40,
    });
  });

  it("--off disables it", async () => {
    await runCanaryAutoAbort({ off: true });
    expect(api.patchCanary).toHaveBeenCalledWith("proj-1", {
      auto_abort_enabled: false,
    });
  });

  it.each([
    [{}, /--rate and --min-sessions, or --off/],
    [{ rate: "10" }, /--rate and --min-sessions, or --off/],
    [{ off: true, rate: "10" }, /cannot be combined/],
    [{ rate: "0", minSessions: "5" }, /greater than 0/],
    [{ rate: "10", minSessions: "0" }, /whole number/],
  ])("rejects %j without a request", async (options, message) => {
    await expect(runCanaryAutoAbort(options)).rejects.toThrow(message);
    expect(api.patchCanary).not.toHaveBeenCalled();
  });
});

describe("canary promote and abort confirmation", () => {
  it("--yes skips the prompt", async () => {
    await runCanaryPromote({ yes: true });
    await runCanaryAbort({ yes: true });
    expect(promptYesNo).not.toHaveBeenCalled();
    expect(api.promoteCanary).toHaveBeenCalledWith("proj-1");
    expect(api.abortCanary).toHaveBeenCalledWith("proj-1");
  });

  it("asks in a terminal and proceeds on yes", async () => {
    isInteractive.mockReturnValue(true);
    promptYesNo.mockResolvedValue(true);
    await runCanaryPromote({});
    expect(promptYesNo).toHaveBeenCalledTimes(1);
    expect(api.promoteCanary).toHaveBeenCalled();
  });

  it("does nothing when the answer is no", async () => {
    isInteractive.mockReturnValue(true);
    promptYesNo.mockResolvedValue(false);
    await expect(runCanaryAbort({})).rejects.toThrow(/Cancelled/);
    expect(api.abortCanary).not.toHaveBeenCalled();
  });

  it("refuses without --yes when not interactive", async () => {
    await expect(runCanaryPromote({})).rejects.toThrow(/pass --yes/);
    await expect(runCanaryAbort({})).rejects.toThrow(/pass --yes/);
    expect(api.promoteCanary).not.toHaveBeenCalled();
    expect(api.abortCanary).not.toHaveBeenCalled();
  });
});
