import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsLogsList } from "./list.js";

const listProjectLogs = vi.fn();
const listSessionLogs = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectLogs,
    listSessionLogs,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const sampleLog = {
  id: "log-1",
  org_id: "org-1",
  project_id: "proj-1",
  session_id: "sess-1",
  orchestrator_session_id: "orch-session-abc123",
  level: "info" as const,
  message: "game-sync: player joined",
  fields: { peerId: "peer-1" },
  created_at: "2026-07-07T05:00:00.000Z",
};

describe("runProjectsLogsList", () => {
  beforeEach(() => {
    listProjectLogs.mockReset();
    listSessionLogs.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("prints TSV rows for project logs", async () => {
    listProjectLogs.mockResolvedValue({
      project_id: "proj-1",
      logs: [sampleLog],
    });

    await runProjectsLogsList({});

    expect(listProjectLogs).toHaveBeenCalledWith("proj-1", { limit: 20 });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("game-sync: player joined"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("orch-session"),
    );
  });

  it("prints TSV rows for session-scoped logs", async () => {
    listSessionLogs.mockResolvedValue({
      project_id: "proj-1",
      orchestrator_session_id: "orch-session-abc123",
      logs: [sampleLog],
    });

    await runProjectsLogsList({ sessionId: "orch-session-abc123" });

    expect(listSessionLogs).toHaveBeenCalledWith(
      "proj-1",
      "orch-session-abc123",
      { limit: 20 },
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("game-sync: player joined"),
    );
  });

  it("passes search filters to the API", async () => {
    listProjectLogs.mockResolvedValue({
      project_id: "proj-1",
      logs: [],
    });

    await runProjectsLogsList({
      limit: 10,
      q: "player",
      level: "warn",
    });

    expect(listProjectLogs).toHaveBeenCalledWith("proj-1", {
      limit: 10,
      q: "player",
      level: "warn",
    });
  });

  it("outputs JSON when --json is set", async () => {
    listSessionLogs.mockResolvedValue({
      project_id: "proj-1",
      orchestrator_session_id: "orch-session-abc123",
      logs: [sampleLog],
    });

    await runProjectsLogsList({
      sessionId: "orch-session-abc123",
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          project_id: "proj-1",
          orchestrator_session_id: "orch-session-abc123",
          logs: [sampleLog],
        },
        null,
        2,
      ),
    );
  });

  it("uses explicit project id over linked config", async () => {
    listProjectLogs.mockResolvedValue({
      project_id: "proj-2",
      logs: [],
    });

    await runProjectsLogsList({ projectId: "proj-2", limit: 5 });

    expect(requireProjectId).not.toHaveBeenCalled();
    expect(listProjectLogs).toHaveBeenCalledWith("proj-2", { limit: 5 });
  });
});
