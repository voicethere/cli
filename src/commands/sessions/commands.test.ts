import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSessionsBilling } from "./billing.js";
import { runSessionsList } from "./list.js";

const listProjectSessions = vi.fn();
const getProjectSession = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectSessions,
    getProjectSession,
  })),
}));

vi.mock("../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("sessions commands", () => {
  beforeEach(() => {
    listProjectSessions.mockReset();
    getProjectSession.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runSessionsList", () => {
    it("lists sessions with pagination args", async () => {
      listProjectSessions.mockResolvedValue([
        {
          id: "db-1",
          orchestrator_session_id: "orch-1",
          status: "ended",
          build_id: null,
          created_at: "2026-06-19T00:00:00.000Z",
          ended_at: "2026-06-19T00:01:00.000Z",
          end_reason: "client_disconnected",
          billable_seconds: 42,
          expires_at: null,
        },
      ]);

      await runSessionsList({ start: 0, end: 10 });

      expect(listProjectSessions).toHaveBeenCalledWith("proj-1", {
        start: 0,
        end: 10,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("orch-1\tended\tbillable=42"),
      );
    });
  });

  describe("runSessionsBilling", () => {
    it("prints billing fields for a session", async () => {
      getProjectSession.mockResolvedValue({
        id: "db-1",
        orchestrator_session_id: "orch-1",
        status: "ended",
        build_id: null,
        created_at: "2026-06-19T00:00:00.000Z",
        ended_at: "2026-06-19T00:01:00.000Z",
        end_reason: "client_disconnected",
        billable_seconds: 42,
        expires_at: null,
      });

      await runSessionsBilling({ sessionId: "orch-1" });

      expect(getProjectSession).toHaveBeenCalledWith("proj-1", "orch-1");
      expect(console.log).toHaveBeenCalledWith("billable_seconds=42");
    });
  });
});
