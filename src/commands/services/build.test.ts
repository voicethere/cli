import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repoOfReference, runServicesBuild } from "./build.js";

const spawn = vi.fn();
const runProjectsServicesSet = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawn(...args),
}));
vi.mock("../projects/services/commands.js", () => ({
  runProjectsServicesSet: (...args: unknown[]) =>
    runProjectsServicesSet(...args),
}));

const DIGEST = `sha256:${"a".repeat(64)}`;

function fakeChild(opts: { stdout?: string; code?: number; error?: Error }) {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
  child.stdout = new EventEmitter();
  queueMicrotask(() => {
    if (opts.error) {
      child.emit("error", opts.error);
      return;
    }
    if (opts.stdout) child.stdout.emit("data", Buffer.from(opts.stdout));
    child.emit("close", opts.code ?? 0);
  });
  return child;
}

describe("services build", () => {
  beforeEach(() => {
    spawn.mockReset();
    runProjectsServicesSet.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("services build runs buildx with linux/amd64 and sets the digest image", async () => {
    spawn
      .mockImplementationOnce(() => fakeChild({}))
      .mockImplementationOnce(() =>
        fakeChild({ stdout: JSON.stringify({ digest: DIGEST }) }),
      );

    await runServicesBuild({
      name: "mcp",
      push: "ghcr.io/acme/mcp:v1",
      projectId: "proj-1",
    });

    expect(spawn.mock.calls[0]![0]).toBe("docker");
    expect(spawn.mock.calls[0]![1]).toEqual([
      "buildx",
      "build",
      "--platform",
      "linux/amd64",
      "-f",
      "Dockerfile",
      "-t",
      "ghcr.io/acme/mcp:v1",
      "--push",
      ".",
    ]);
    expect(spawn.mock.calls[0]![2]).toMatchObject({ stdio: "inherit" });
    expect(spawn.mock.calls[1]![1]).toEqual([
      "buildx",
      "imagetools",
      "inspect",
      "ghcr.io/acme/mcp:v1",
      "--format",
      "{{json .Manifest}}",
    ]);
    expect(runProjectsServicesSet).toHaveBeenCalledWith({
      name: "mcp",
      image: `ghcr.io/acme/mcp@${DIGEST}`,
      projectId: "proj-1",
    });
  });

  it("services build fails clearly without docker", async () => {
    const error = Object.assign(new Error("spawn docker ENOENT"), {
      code: "ENOENT",
    });
    spawn.mockImplementationOnce(() => fakeChild({ error }));

    await expect(
      runServicesBuild({ name: "mcp", push: "ghcr.io/acme/mcp:v1" }),
    ).rejects.toThrow("docker with buildx was not found");
    expect(runProjectsServicesSet).not.toHaveBeenCalled();
  });

  it("strips the tag but keeps a registry port", () => {
    expect(repoOfReference("localhost:5000/app:v1")).toBe("localhost:5000/app");
    expect(repoOfReference("localhost:5000/app")).toBe("localhost:5000/app");
  });
});
