import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, VoicethereApi } from "./api.js";

const apiKey = "vth_test";
const apiBase = "https://app.voicethere.dev/api/v1";

function mockFetch(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function requestedUrl(fetchMock: ReturnType<typeof mockFetch>): string {
  const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return url.toString();
}

describe("deployment history requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists deployments without a query by default", async () => {
    const fetchMock = mockFetch(200, { deployments: [], next_before: null });
    const api = new VoicethereApi(apiKey, apiBase);

    const result = await api.listProjectDeployments("proj-1");

    expect(result).toEqual({ deployments: [], next_before: null });
    expect(requestedUrl(fetchMock)).toBe(`${apiBase}/projects/proj-1/deployments`);
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${apiKey}` });
  });

  it("sends limit and before as query params", async () => {
    const fetchMock = mockFetch(200, { deployments: [], next_before: null });
    const api = new VoicethereApi(apiKey, apiBase);

    await api.listProjectDeployments("proj-1", {
      limit: 5,
      before: "2026-10-17T12:00:00.000Z",
    });

    expect(requestedUrl(fetchMock)).toBe(
      `${apiBase}/projects/proj-1/deployments?limit=5&before=2026-10-17T12%3A00%3A00.000Z`,
    );
  });

  it("reads the events of one deployment", async () => {
    const body = { deployment: { id: "dep-1" }, events: [], derived: true };
    const fetchMock = mockFetch(200, body);
    const api = new VoicethereApi(apiKey, apiBase);

    const result = await api.getDeploymentEvents("proj-1", "dep-1");

    expect(result).toEqual(body);
    expect(requestedUrl(fetchMock)).toBe(
      `${apiBase}/projects/proj-1/deployments/dep-1/events`,
    );
  });

  it("surfaces a 404 for a deployment outside the project", async () => {
    mockFetch(404, { error: { code: "not_found", message: "Not found" } });
    const api = new VoicethereApi(apiKey, apiBase);

    const err = await api
      .getDeploymentEvents("proj-1", "other")
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });
});

describe("canary requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function call(fetchMock: ReturnType<typeof mockFetch>) {
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    return { url: url.toString(), init };
  }

  it("PATCH /projects/{id}/canary sends the snake_case body", async () => {
    const fetchMock = mockFetch(200, { canary: {} });
    await new VoicethereApi(apiKey, apiBase).patchCanary("proj-1", {
      canary_pods: 2,
      routing_mode: "customer_context",
      routing_context_field: "tier",
    });
    const { url, init } = call(fetchMock);
    expect(url).toBe(`${apiBase}/projects/proj-1/canary`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      canary_pods: 2,
      routing_mode: "customer_context",
      routing_context_field: "tier",
    });
  });

  it("promote and abort POST to their paths", async () => {
    const promote = mockFetch(200, { promoted: true });
    await new VoicethereApi(apiKey, apiBase).promoteCanary("proj-1");
    expect(call(promote).url).toBe(`${apiBase}/projects/proj-1/canary/promote`);
    expect(call(promote).init.method).toBe("POST");
    vi.restoreAllMocks();
    const abort = mockFetch(200, { aborted: true });
    await new VoicethereApi(apiKey, apiBase).abortCanary("proj-1");
    expect(call(abort).url).toBe(`${apiBase}/projects/proj-1/canary/abort`);
  });

  it("GET deployments/metrics passes from and to", async () => {
    const fetchMock = mockFetch(200, { deployments: [] });
    await new VoicethereApi(apiKey, apiBase).getDeploymentMetrics("proj-1", {
      from: "2026-10-23T00:00:00.000Z",
      to: "2026-10-24T00:00:00.000Z",
    });
    expect(call(fetchMock).url).toBe(
      `${apiBase}/projects/proj-1/deployments/metrics?from=2026-10-23T00%3A00%3A00.000Z&to=2026-10-24T00%3A00%3A00.000Z`,
    );
  });
});
