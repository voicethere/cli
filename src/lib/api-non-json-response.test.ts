import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  formatCliError,
  NON_JSON_RESPONSE_CODE,
  NonJsonResponseError,
  nonJsonBodyExcerpt,
  VoicethereApi,
} from "./api.js";
import { createUserApi } from "./user-api.js";

const apiKey = "vth_test";
const apiBase = "https://app.voicethere.dev/api/v1";

/** Shape of an edge (CDN/proxy) timeout page: HTML, not JSON. */
const EDGE_TIMEOUT_PAGE = `<!DOCTYPE html>
<html lang="en-US">
<head><title>app.voicethere.dev | 524: A timeout occurred</title></head>
<body><h1>A timeout occurred</h1></body>
</html>`;

const BAD_GATEWAY_PAGE = `<!DOCTYPE html>
<html><head><title>502 Bad Gateway</title></head><body>bad gateway</body></html>`;

const deploymentJob = {
  id: "job-1",
  project_id: "proj-1",
  build_id: "build-1",
  status: "active",
  mode: "drain",
};

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("non-JSON API responses", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deploy poll: a 524 HTML page is retried and the next JSON answer is returned", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(htmlResponse(524, EDGE_TIMEOUT_PAGE))
      .mockResolvedValueOnce(htmlResponse(502, BAD_GATEWAY_PAGE))
      .mockResolvedValueOnce(jsonResponse(200, deploymentJob));

    const api = new VoicethereApi(apiKey, apiBase);
    const pending = api.getDeployment("job-1");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({ id: "job-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("deploy poll: HTML 5xx on every attempt ends in a named error with status and excerpt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(htmlResponse(524, EDGE_TIMEOUT_PAGE)),
      );

    const api = new VoicethereApi(apiKey, apiBase);
    const pending = api.getDeployment("job-1");
    const assertion =
      expect(pending).rejects.toBeInstanceOf(NonJsonResponseError);
    await vi.runAllTimersAsync();
    await assertion;

    const error = (await pending.catch(
      (e: unknown) => e,
    )) as NonJsonResponseError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe("NonJsonResponseError");
    expect(error.status).toBe(524);
    expect(error.code).toBe(NON_JSON_RESPONSE_CODE);
    expect(error.message).toBe(
      "Unexpected non-JSON response from GET /api/v1/deployments/job-1 (HTTP 524): app.voicethere.dev | 524: A timeout occurred",
    );
    expect(error.message).not.toContain("Unexpected token");
    expect(formatCliError(error)).toContain("HTTP 524");
    // 1 attempt + 7 bounded retries
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("POST /deployments: an HTML 502 is a named error and is not retried", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(htmlResponse(502, BAD_GATEWAY_PAGE));

    const api = new VoicethereApi(apiKey, apiBase);
    const error = (await api
      .createDeployment({ project_id: "proj-1", mode: "drain" })
      .catch((e: unknown) => e)) as NonJsonResponseError;

    expect(error).toBeInstanceOf(NonJsonResponseError);
    expect(error.status).toBe(502);
    expect(error.message).toBe(
      "Unexpected non-JSON response from POST /api/v1/deployments (HTTP 502): 502 Bad Gateway",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST: a JSON 503 is surfaced once, never resent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(503, {
        error: { code: "UNAVAILABLE", message: "try later" },
      }),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    await expect(
      api.createDeployment({ project_id: "proj-1", mode: "drain" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "try later",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST: a connection reset after sending is not retried", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("socket hang up"), {
          code: "ECONNRESET",
        }),
      }),
    );

    const api = new VoicethereApi(apiKey, apiBase);
    await expect(
      api.createDeployment({ project_id: "proj-1", mode: "drain" }),
    ).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST: a refused connection (request never sent) is retried", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(
        new TypeError("fetch failed", {
          cause: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }),
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, deploymentJob));

    const api = new VoicethereApi(apiKey, apiBase);
    const pending = api.createDeployment({
      project_id: "proj-1",
      mode: "drain",
    });
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({ id: "job-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("GET: a 2xx HTML page is a named error without retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(htmlResponse(200, "<html><body>portal</body></html>"));

    const api = new VoicethereApi(apiKey, apiBase);
    await expect(api.getDeployment("job-1")).rejects.toMatchObject({
      name: "NonJsonResponseError",
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("GET: a non-JSON 4xx is a named error without retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        htmlResponse(404, "<html><title>Not Found</title></html>"),
      );

    const api = new VoicethereApi(apiKey, apiBase);
    await expect(api.getDeployment("job-1")).rejects.toMatchObject({
      name: "NonJsonResponseError",
      status: 404,
      message:
        "Unexpected non-JSON response from GET /api/v1/deployments/job-1 (HTTP 404): Not Found",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("user API: an HTML 5xx on a POST is a named error and is not retried", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(htmlResponse(502, BAD_GATEWAY_PAGE));

    const userApi = createUserApi(apiBase, {
      kind: "user_api_key",
      token: "vthu_test",
      activeOrgId: "org-1",
    });
    const error = await userApi.setActiveOrg("org-2").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NonJsonResponseError);
    expect((error as NonJsonResponseError).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("nonJsonBodyExcerpt", () => {
  it("prefers the HTML title", () => {
    expect(nonJsonBodyExcerpt(EDGE_TIMEOUT_PAGE)).toBe(
      "app.voicethere.dev | 524: A timeout occurred",
    );
  });

  it("collapses whitespace and caps plain text", () => {
    const long = `upstream   connect error\n${"x".repeat(400)}`;
    const excerpt = nonJsonBodyExcerpt(long);
    expect(excerpt.startsWith("upstream connect error x")).toBe(true);
    expect(excerpt.length).toBe(161);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
