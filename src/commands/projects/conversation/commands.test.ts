import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runProjectsConversationExport,
  runProjectsConversationGet,
  runProjectsConversationList,
  runProjectsConversationSearch,
} from "./commands.js";

const listProjectConversations = vi.fn();
const getSessionConversation = vi.fn();
const createConversationExport = vi.fn();
const getConversationExport = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectConversations,
    getSessionConversation,
    createConversationExport,
    getConversationExport,
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
    createConversationExport.mockReset();
    getConversationExport.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn());

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

  it("passes time-window query params to listProjectConversations", async () => {
    listProjectConversations.mockResolvedValue({
      project_id: "proj-1",
      conversations: [],
    });

    await runProjectsConversationList({
      period: "7d",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T00:00:00.000Z",
      cursor: "cursor-token",
    });

    expect(listProjectConversations).toHaveBeenCalledWith("proj-1", {
      limit: 50,
      period: "7d",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T00:00:00.000Z",
      cursor: "cursor-token",
    });
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

    await runProjectsConversationSearch({
      query: "hello",
      limit: 5,
      period: "24h",
    });

    expect(listProjectConversations).toHaveBeenCalledWith("proj-1", {
      limit: 5,
      q: "hello",
      period: "24h",
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

  it("creates a session export job without polling", async () => {
    createConversationExport.mockResolvedValue({ job_id: "export-job-1" });

    await runProjectsConversationExport({ session: "orch-session-abc123" });

    expect(createConversationExport).toHaveBeenCalledWith("proj-1", {
      mode: "session",
      sessionId: "orch-session-abc123",
    });
    expect(getConversationExport).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      "Conversation export queued: export-job-1",
    );
  });

  it("creates a filter export job with q and time window", async () => {
    createConversationExport.mockResolvedValue({ job_id: "export-job-2" });

    await runProjectsConversationExport({
      q: "inventory",
      period: "30d",
    });

    expect(createConversationExport).toHaveBeenCalledWith("proj-1", {
      mode: "filter",
      q: "inventory",
      period: "30d",
    });
  });

  it("creates an all-conversations filter export", async () => {
    createConversationExport.mockResolvedValue({ job_id: "export-job-3" });

    await runProjectsConversationExport({ all: true, from: "2026-07-01T00:00:00.000Z" });

    expect(createConversationExport).toHaveBeenCalledWith("proj-1", {
      mode: "filter",
      from: "2026-07-01T00:00:00.000Z",
    });
  });

  it("polls until export completes when --wait is set", async () => {
    createConversationExport.mockResolvedValue({ job_id: "export-job-4" });
    getConversationExport
      .mockResolvedValueOnce({
        job_id: "export-job-4",
        status: "active",
        progress: { conversations_total: 2, conversations_done: 1 },
        created_at: "2026-07-30T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        job_id: "export-job-4",
        status: "completed",
        progress: { conversations_total: 2, conversations_done: 2 },
        download_url: "https://example.com/export.json",
        expires_at: "2026-07-31T00:00:00.000Z",
        created_at: "2026-07-30T00:00:00.000Z",
        completed_at: "2026-07-30T00:01:00.000Z",
      });

    await runProjectsConversationExport({
      all: true,
      wait: true,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    expect(getConversationExport).toHaveBeenCalledWith("proj-1", "export-job-4");
    expect(getConversationExport).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      "Conversation export completed: export-job-4",
    );
  });

  it("throws when export fails after wait", async () => {
    createConversationExport.mockResolvedValue({ job_id: "export-job-5" });
    getConversationExport.mockResolvedValue({
      job_id: "export-job-5",
      status: "failed",
      progress: { conversations_total: 1, conversations_done: 0 },
      error: "too many conversations",
      created_at: "2026-07-30T00:00:00.000Z",
    });

    await expect(
      runProjectsConversationExport({
        all: true,
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow(/too many conversations/);
  });

  it("requires an export mode", async () => {
    await expect(runProjectsConversationExport({})).rejects.toThrow(
      /Specify --session/,
    );
  });

  it("requires --wait when --output is set", async () => {
    await expect(
      runProjectsConversationExport({
        all: true,
        output: "/tmp/export.json",
      }),
    ).rejects.toThrow(/--output requires --wait/);
  });
});
