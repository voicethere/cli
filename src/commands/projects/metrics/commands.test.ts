import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsMetricsAgent, truncateMessage } from "./agent.js";
import { runProjectsMetricsOverview } from "./overview.js";
import { runProjectsMetricsSessions } from "./sessions.js";
import { runProjectsMetricsVoice } from "./voice.js";

const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const API_BASE = "https://app.voicethere.dev/api/v1";

const overview = {
  project_id: "proj-1",
  period: "24h",
  range_start: null,
  range_end: null,
  active_sessions: 2,
  sessions_started: 10,
  sessions_ended: 7,
  sessions_failed: 1,
  billable_seconds: 600,
  monthly_billable_seconds: 6000,
  error_rate: 0.125,
  sessions_in_queue: 0,
  avg_queue_wait_seconds: 1.5,
  finalize_supabase_patches_total: 0,
  active_build_id: null,
  last_deploy_at: null,
};

const sessionMetrics = {
  project_id: "proj-1",
  period: "7d",
  range_start: "2026-10-02T00:00:00.000Z",
  range_end: "2026-10-09T00:00:00.000Z",
  bucket_seconds: 3600,
  series: [
    {
      bucket_start: "2026-10-08T00:00:00.000Z",
      started: 4,
      completed: 3,
      failed: 1,
      never_connected: 0,
      peak_concurrent: 2,
      connect_p50_s: 1,
      connect_p95_s: 2,
      queue_wait_p50_s: null,
      queue_wait_p95_s: null,
      queued: 0,
    },
    {
      bucket_start: "2026-10-08T01:00:00.000Z",
      started: 6,
      completed: 4,
      failed: 1,
      never_connected: 1,
      peak_concurrent: 5,
      connect_p50_s: 1,
      connect_p95_s: 2,
      queue_wait_p50_s: null,
      queue_wait_p95_s: null,
      queued: 0,
    },
  ],
  plan_concurrency_limit: 20,
  duration_buckets: [],
  duration_p50_s: 30,
  duration_p95_s: 120,
  connect_p50_s: 1,
  connect_p95_s: 2.5,
  queue_wait_p95_s: null,
  failures: [
    { code: "AGENT_HANDLER_FAILED", count: 2 },
    { code: "RUNNER_START_TIMEOUT", count: 1 },
  ],
  end_reasons: [{ reason: "client_disconnected", count: 7 }],
};

const longMessage = `${"x".repeat(150)}`;
const agentMetrics = {
  project_id: "proj-1",
  period: null,
  range_start: "2026-10-01T00:00:00.000Z",
  range_end: "2026-10-02T00:00:00.000Z",
  bucket_seconds: 900,
  series: [
    {
      bucket_start: "2026-10-01T00:00:00.000Z",
      warn: 1,
      error: 3,
      info: 9,
      crashes: 1,
    },
    {
      bucket_start: "2026-10-01T00:15:00.000Z",
      warn: 0,
      error: 2,
      info: 4,
      crashes: 0,
    },
  ],
  top_errors: [
    { message: "TypeError: boom", count: 4 },
    { message: longMessage, count: 1 },
  ],
  turns_per_conversation_p50: 6,
  turns_per_conversation_p95: 14,
};

const block = (p50: number | null, p95: number | null, p99: number | null) => ({
  p50_ms: p50,
  p95_ms: p95,
  p99_ms: p99,
  series: [],
});
const voiceMetrics = {
  project_id: "proj-1",
  period: "6h",
  range_start: "2026-10-09T00:00:00.000Z",
  range_end: "2026-10-09T06:00:00.000Z",
  available: true,
  range_too_long: false,
  stt: block(100, 200, 300),
  tts: block(110, 210, 310),
  turn_response: block(620, 900, 1200),
  final_to_audio: block(400, 700, 900),
  finalize_delay: block(50, 80, 90),
  tts_first_audio: block(null, null, null),
};

function mockFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(String(fetchMock.mock.calls[0][0]));
}

function printed(): string {
  return (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => String(c[0]))
    .join("\n");
}

describe("projects metrics commands", () => {
  beforeEach(() => {
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: API_BASE,
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("overview calls /metrics with period and prints headline totals", async () => {
    const fetchMock = mockFetch(overview);
    await runProjectsMetricsOverview({ period: "24h" });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/projects/proj-1/metrics");
    expect(url.searchParams.get("period")).toBe("24h");
    const out = printed();
    expect(out).toContain("Project metrics (24h)");
    expect(out).toContain("sessions started:    10");
    expect(out).toContain("sessions failed:     1");
    expect(out).toContain("error rate:          12.5%");
  });

  it("overview --json prints the raw response", async () => {
    mockFetch(overview);
    await runProjectsMetricsOverview({ json: true });
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(overview, null, 2));
  });

  it("overview sends start and end for a custom window", async () => {
    const fetchMock = mockFetch(overview);
    await runProjectsMetricsOverview({
      projectId: "proj-9",
      start: "2026-10-01T00:00:00Z",
      end: "2026-10-02T00:00:00Z",
    });
    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/projects/proj-9/metrics");
    expect(url.searchParams.get("start")).toBe("2026-10-01T00:00:00Z");
    expect(url.searchParams.get("end")).toBe("2026-10-02T00:00:00Z");
    expect(url.searchParams.has("period")).toBe(false);
    expect(requireProjectId).not.toHaveBeenCalled();
  });

  it("rejects a bad range before any HTTP call", async () => {
    const fetchMock = mockFetch(overview);
    await expect(runProjectsMetricsOverview({ period: "90d" })).rejects.toThrow(
      /--period/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sessions calls /metrics/sessions and prints totals and failures by reason", async () => {
    const fetchMock = mockFetch(sessionMetrics);
    await runProjectsMetricsSessions({ period: "7d" });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/projects/proj-1/metrics/sessions");
    expect(url.searchParams.get("period")).toBe("7d");
    const out = printed();
    expect(out).toContain("started:             10");
    expect(out).toContain("failed:              2");
    expect(out).toContain("never connected:     1");
    expect(out).toContain("peak concurrent:     5 (plan limit 20)");
    expect(out).toContain("Failures by reason");
    expect(out).toMatch(/AGENT_HANDLER_FAILED\s+2/);
    expect(out).toMatch(/RUNNER_START_TIMEOUT\s+1/);
  });

  it("sessions --json prints the raw response", async () => {
    mockFetch(sessionMetrics);
    await runProjectsMetricsSessions({ json: true });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(sessionMetrics, null, 2),
    );
  });

  it("agent calls /metrics/agent and prints totals and top errors", async () => {
    const fetchMock = mockFetch(agentMetrics);
    await runProjectsMetricsAgent({
      start: "2026-10-01T00:00:00Z",
      end: "2026-10-02T00:00:00Z",
    });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/projects/proj-1/metrics/agent");
    expect(url.searchParams.get("start")).toBe("2026-10-01T00:00:00Z");
    const out = printed();
    expect(out).toContain("errors:              5");
    expect(out).toContain("crashes:             1");
    expect(out).toMatch(/TypeError: boom\s+4/);
    expect(out).toContain(`${"x".repeat(97)}...`);
    expect(out).not.toContain("x".repeat(98));
  });

  it("agent --json prints the raw response", async () => {
    mockFetch(agentMetrics);
    await runProjectsMetricsAgent({ json: true });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(agentMetrics, null, 2),
    );
  });

  it("truncateMessage keeps short messages and cuts at 100 characters", () => {
    expect(truncateMessage("short")).toBe("short");
    expect(truncateMessage("a".repeat(100))).toHaveLength(100);
    expect(truncateMessage("a".repeat(101))).toHaveLength(100);
  });

  it("voice calls /voice-metrics and prints p50/p95/p99 per block", async () => {
    const fetchMock = mockFetch(voiceMetrics);
    await runProjectsMetricsVoice({ period: "6h" });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/projects/proj-1/voice-metrics");
    expect(url.searchParams.get("period")).toBe("6h");
    const out = printed();
    expect(out).toContain("STT: p50 100 ms, p95 200 ms, p99 300 ms");
    expect(out).toContain("p50 620 ms, p95 900 ms, p99 1200 ms");
    expect(out).toContain("TTS first audio: p50 - ms, p95 - ms, p99 - ms");
  });

  it("voice rejects 30d (not a voice period) before any HTTP call", async () => {
    const fetchMock = mockFetch(voiceMetrics);
    await expect(runProjectsMetricsVoice({ period: "30d" })).rejects.toThrow(
      /--period must be one of: 1h, 6h, 24h, 7d/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("voice --json prints the raw response", async () => {
    mockFetch(voiceMetrics);
    await runProjectsMetricsVoice({ json: true });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(voiceMetrics, null, 2),
    );
  });

  it("voice tells the user when the range is longer than the retention", async () => {
    mockFetch({ ...voiceMetrics, range_too_long: true });
    await runProjectsMetricsVoice({});
    expect(printed()).toContain("kept for 14 days");
  });
});
