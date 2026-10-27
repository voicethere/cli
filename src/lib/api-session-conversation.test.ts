import { afterEach, describe, expect, it, vi } from "vitest";
import { VoicethereApi } from "./api.js";

const apiBase = "https://app.voicethere.dev/api/v1";

function mockFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(JSON.stringify({ turns: [] }), { status: 200 }),
    );
}

function url(fetchMock: ReturnType<typeof mockFetch>): string {
  const [u] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return u.toString();
}

describe("getSessionConversation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends no include param by default", async () => {
    const fetchMock = mockFetch();
    await new VoicethereApi("vth_test", apiBase).getSessionConversation(
      "proj-1",
      "sess-1",
    );
    expect(url(fetchMock)).toBe(
      `${apiBase}/projects/proj-1/sessions/sess-1/conversation`,
    );
  });

  it("sends include=tool_calls when requested", async () => {
    const fetchMock = mockFetch();
    await new VoicethereApi("vth_test", apiBase).getSessionConversation(
      "proj-1",
      "sess-1",
      { includeToolCalls: true },
    );
    expect(url(fetchMock)).toBe(
      `${apiBase}/projects/proj-1/sessions/sess-1/conversation?include=tool_calls`,
    );
  });
});
