import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../lib/api.js";
import {
  runProjectsServicesRotateToken,
  runProjectsServicesSet,
} from "./commands.js";
import { parseHealthFlag, parsePortFlag } from "./parse.js";

const listProjectServices = vi.fn();
const putProjectService = vi.fn();
const rotateProjectServiceToken = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/api.js")>();
  return {
    ...actual,
    createApi: vi.fn(() => ({
      listProjectServices,
      putProjectService,
      rotateProjectServiceToken,
    })),
  };
});

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects services commands", () => {
  beforeEach(() => {
    for (const fn of [
      listProjectServices,
      putProjectService,
      rotateProjectServiceToken,
      requireCredentials,
      requireProjectId,
    ]) {
      fn.mockReset();
    }
    vi.spyOn(console, "log").mockImplementation(() => {});
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
    listProjectServices.mockResolvedValue({ services: [], maxServices: 3 });
  });

  it("services set creates a service from flags", async () => {
    putProjectService.mockResolvedValue({
      service: { name: "mcp", image: "ghcr.io/acme/mcp:1" },
      requiresRedeploy: true,
    });

    await runProjectsServicesSet({
      name: "mcp",
      image: "ghcr.io/acme/mcp:1",
      port: ["mcp:8080"],
      health: "http:/healthz:8080",
      env: ["LOG=debug"],
    });

    expect(putProjectService).toHaveBeenCalledWith("proj-1", "mcp", {
      image: "ghcr.io/acme/mcp:1",
      ports: [{ name: "mcp", port: 8080 }],
      health: { type: "http", path: "/healthz", port: 8080 },
      envPlain: { LOG: "debug" },
    });
    expect(console.log).toHaveBeenCalledWith("Run voicethere deploy to apply.");
  });

  it("services set requires image and health on create", async () => {
    await expect(
      runProjectsServicesSet({ name: "mcp", health: "tcp:8080" }),
    ).rejects.toThrow("--image is required");
    await expect(
      runProjectsServicesSet({ name: "mcp", image: "a:1" }),
    ).rejects.toThrow("--health is required");
    expect(putProjectService).not.toHaveBeenCalled();
  });

  it("services set merges flags over the existing service", async () => {
    listProjectServices.mockResolvedValue({
      maxServices: 3,
      services: [
        {
          name: "mcp",
          image: "ghcr.io/acme/mcp:1",
          ports: [{ name: "mcp", port: 8080 }],
          health: { type: "tcp", port: 8080 },
          cpuMillis: 250,
          memoryMib: 256,
          enabled: false,
          tokenVersion: 4,
          registryCredential: null,
        },
      ],
    });
    putProjectService.mockResolvedValue({
      service: { name: "mcp" },
      requiresRedeploy: false,
    });

    await runProjectsServicesSet({ name: "mcp", memory: "512" });

    expect(putProjectService).toHaveBeenCalledWith("proj-1", "mcp", {
      image: "ghcr.io/acme/mcp:1",
      ports: [{ name: "mcp", port: 8080 }],
      health: { type: "tcp", port: 8080 },
      cpuMillis: 250,
      memoryMib: 512,
      enabled: false,
    });
    expect(console.log).not.toHaveBeenCalledWith(
      "Run voicethere deploy to apply.",
    );
  });

  it("--port and --health parse and reject bad values", () => {
    expect(parsePortFlag("mcp:8080")).toEqual({ name: "mcp", port: 8080 });
    expect(parseHealthFlag("tcp:9000")).toEqual({ type: "tcp", port: 9000 });
    expect(parseHealthFlag("http:/ready:80")).toEqual({
      type: "http",
      path: "/ready",
      port: 80,
    });
    expect(() => parsePortFlag("8080")).toThrow("--port");
    expect(() => parsePortFlag("mcp:70000")).toThrow("1-65535");
    expect(() => parseHealthFlag("http:healthz:80")).toThrow("--health");
    expect(() => parseHealthFlag("udp:80")).toThrow("--health");
  });

  it("--env-from-project all clears key lists", async () => {
    listProjectServices.mockResolvedValue({
      maxServices: 3,
      services: [
        {
          name: "mcp",
          image: "a:1",
          ports: [],
          health: { type: "tcp", port: 1 },
          envFromProject: "selected",
          envKeys: ["A"],
          secretKeys: ["S"],
        },
      ],
    });
    putProjectService.mockResolvedValue({
      service: { name: "mcp" },
      requiresRedeploy: false,
    });

    await runProjectsServicesSet({ name: "mcp", envFromProject: "all" });

    const body = putProjectService.mock.calls[0]![2];
    expect(body.envFromProject).toBe("all");
    expect(body.envKeys).toEqual([]);
    expect(body.secretKeys).toEqual([]);
    await expect(
      runProjectsServicesSet({ name: "mcp", envFromProject: "some" }),
    ).rejects.toThrow("--env-from-project");
  });

  it("rotate-token prints the previous token's end time", async () => {
    rotateProjectServiceToken.mockResolvedValue({
      tokenVersion: 5,
      previousValidUntil: "2026-10-26T12:00:00Z",
    });

    await runProjectsServicesRotateToken({ name: "mcp" });

    expect(console.log).toHaveBeenCalledWith(
      "Previous token valid until: 2026-10-26T12:00:00Z",
    );
  });

  it("API validation errors print the message with the field path", async () => {
    putProjectService.mockRejectedValue(
      new ApiError(400, "ports[0].port: must be at most 65535", {
        error: {
          code: "VALIDATION",
          message: "ports[0].port: must be at most 65535",
        },
      }),
    );

    await expect(
      runProjectsServicesSet({
        name: "mcp",
        image: "a:1",
        health: "tcp:1",
      }),
    ).rejects.toThrow("ports[0].port: must be at most 65535");
  });
});
