import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsErrorsList } from "./list.js";

const listProjectSessionErrors = vi.fn();
const listSessionErrors = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectSessionErrors,
    listSessionErrors,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const sampleError = {
  id: "err-1",
  org_id: "org-1",
  project_id: "proj-1",
  session_id: null,
  orchestrator_session_id: "orch-session-abc123",
  source: "agent" as const,
  code: "AGENT_HANDLER_FAILED",
  message: "e2e crash-agent: intentional handler failure",
  stack_trace: null,
  context: {},
  created_at: "2026-07-07T05:00:00.000Z",
};

describe("runProjectsErrorsList", () => {
  beforeEach(() => {
    listProjectSessionErrors.mockReset();
    listSessionErrors.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("prints TSV rows for project errors", async () => {
    listProjectSessionErrors.mockResolvedValue({
      project_id: "proj-1",
      errors: [sampleError],
    });

    await runProjectsErrorsList({});

    expect(listProjectSessionErrors).toHaveBeenCalledWith("proj-1", 20);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("AGENT_HANDLER_FAILED"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("orch-session"),
    );
  });

  it("prints TSV rows for session-scoped errors", async () => {
    listSessionErrors.mockResolvedValue({
      project_id: "proj-1",
      orchestrator_session_id: "orch-session-abc123",
      errors: [sampleError],
    });

    await runProjectsErrorsList({ sessionId: "orch-session-abc123" });

    expect(listSessionErrors).toHaveBeenCalledWith(
      "proj-1",
      "orch-session-abc123",
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("AGENT_HANDLER_FAILED"),
    );
  });

  it("outputs JSON when --json is set", async () => {
    listSessionErrors.mockResolvedValue({
      project_id: "proj-1",
      orchestrator_session_id: "orch-session-abc123",
      errors: [sampleError],
    });

    await runProjectsErrorsList({
      sessionId: "orch-session-abc123",
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          project_id: "proj-1",
          orchestrator_session_id: "orch-session-abc123",
          errors: [sampleError],
        },
        null,
        2,
      ),
    );
  });

  it("uses explicit project id over linked config", async () => {
    listProjectSessionErrors.mockResolvedValue({
      project_id: "proj-2",
      errors: [],
    });

    await runProjectsErrorsList({ projectId: "proj-2", limit: 5 });

    expect(requireProjectId).not.toHaveBeenCalled();
    expect(listProjectSessionErrors).toHaveBeenCalledWith("proj-2", 5);
  });
});
