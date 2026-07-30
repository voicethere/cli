import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runProjectsConversationGet,
  runProjectsConversationList,
  runProjectsConversationSearch,
} from "./commands.js";

const listProjectConversations = vi.fn();
const getSessionConversation = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectConversations,
    getSessionConversation,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const sampleConversation = {
  id: "conv-1",
  orchestratorSessionId: "orch-session-abc123",
  startedAt: "2026-07-30T00:00:00.000Z",
  endedAt: "2026-07-30T00:01:00.000Z",
  turnCount: 2,
  createdAt: "2026-07-30T00:00:00.000Z",
};

describe("projects conversation commands", () => {
  beforeEach(() => {
    listProjectConversations.mockReset();
    getSessionConversation.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("lists project conversations", async () => {
    listProjectConversations.mockResolvedValue({
      project_id: "proj-1",
      conversations: [sampleConversation],
    });

    await runProjectsConversationList({});

    expect(listProjectConversations).toHaveBeenCalledWith("proj-1", {
      limit: 50,
    });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("orch-session"),
    );
  });

  it("passes search query to listProjectConversations", async () => {
    listProjectConversations.mockResolvedValue({
      project_id: "proj-1",
      conversations: [sampleConversation],
      q: "inventory",
      matches: [
        {
          orchestratorSessionId: "orch-session-abc123",
          turnIndex: 0,
          role: "user",
          eventType: "user_speech_final",
          text: "inventory check",
          occurredAt: "2026-07-30T00:00:10.000Z",
        },
      ],
    });

    await runProjectsConversationList({ q: "inventory", limit: 10 });

    expect(listProjectConversations).toHaveBeenCalledWith("proj-1", {
      limit: 10,
      q: "inventory",
    });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("inventory check"),
    );
  });

  it("search is sugar for list --q", async () => {
    listProjectConversations.mockResolvedValue({
      project_id: "proj-1",
      conversations: [],
      q: "hello",
      matches: [],
    });

    await runProjectsConversationSearch({ query: "hello", limit: 5 });

    expect(listProjectConversations).toHaveBeenCalledWith("proj-1", {
      limit: 5,
      q: "hello",
    });
  });

  it("loads a session conversation", async () => {
    getSessionConversation.mockResolvedValue({
      conversation: {
        id: "conv-1",
        orchestratorSessionId: "orch-session-abc123",
        startedAt: "2026-07-30T00:00:00.000Z",
        endedAt: "2026-07-30T00:01:00.000Z",
        turnCount: 1,
      },
      turns: [
        {
          turnIndex: 0,
          role: "user",
          eventType: "user_speech_final",
          text: "hello",
          occurredAt: "2026-07-30T00:00:10.000Z",
        },
      ],
    });

    await runProjectsConversationGet({ sessionId: "orch-session-abc123" });

    expect(getSessionConversation).toHaveBeenCalledWith(
      "proj-1",
      "orch-session-abc123",
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hello"));
  });

  it("outputs JSON when --json is set", async () => {
    listProjectConversations.mockResolvedValue({
      project_id: "proj-1",
      conversations: [sampleConversation],
    });

    await runProjectsConversationList({ json: true });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          project_id: "proj-1",
          conversations: [sampleConversation],
        },
        null,
        2,
      ),
    );
  });
});
