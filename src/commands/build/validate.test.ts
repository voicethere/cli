import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentVerifySpawnArgs,
  resolveAgentCliJs,
  runBuildValidate,
} from "./validate.js";

const resolveBundlePathDetailed = vi.fn();
const assertBundleExists = vi.fn();
const spawnMock = vi.fn();

vi.mock("../../lib/project-config.js", () => ({
  resolveBundlePathDetailed: (...args: unknown[]) =>
    resolveBundlePathDetailed(...args),
  assertBundleExists: (...args: unknown[]) => assertBundleExists(...args),
}));

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe("resolveAgentCliJs", () => {
  it("resolves the installed @voicethere/agent bin script", () => {
    const require = createRequire(import.meta.url);
    const agentEntry = require.resolve("@voicethere/agent");
    const packageDir = dirname(dirname(agentEntry));
    const pkg = JSON.parse(
      readFileSync(join(packageDir, "package.json"), "utf8"),
    ) as { bin?: string };
    const expected = join(packageDir, pkg.bin as string);

    expect(resolveAgentCliJs()).toBe(expected);
    expect(resolveAgentCliJs()).toMatch(/[/\\]dist[/\\]cli\.js$/);
  });
});

describe("agentVerifySpawnArgs", () => {
  it("uses node and local agent verify argv without npx", () => {
    const bundlePath = "/tmp/dist/agent.js";
    const { cmd, args } = agentVerifySpawnArgs(bundlePath);

    expect(cmd).toBe(process.execPath);
    expect(args).toEqual([
      resolveAgentCliJs(),
      "verify",
      "--no-build",
      "--bundle",
      bundlePath,
    ]);
    expect(args.join(" ")).not.toContain("npx");
    expect(args).not.toContain("@voicethere/agent");
  });
});

describe("runBuildValidate", () => {
  beforeEach(() => {
    resolveBundlePathDetailed.mockReset();
    assertBundleExists.mockReset();
    spawnMock.mockReset();
    resolveBundlePathDetailed.mockResolvedValue({
      absolutePath: "/proj/dist/agent.js",
      relativePath: "dist/agent.js",
      cwd: "/proj",
    });
    assertBundleExists.mockResolvedValue(undefined);
    spawnMock.mockReturnValue({
      on(event: string, handler: (code?: number) => void) {
        if (event === "close") {
          handler(0);
        }
      },
    });
  });

  it("spawns local agent verify with node", async () => {
    await runBuildValidate({ file: "dist/agent.js", logContext: false });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe(process.execPath);
    expect(args).toEqual([
      resolveAgentCliJs(),
      "verify",
      "--no-build",
      "--bundle",
      "/proj/dist/agent.js",
    ]);
    expect(args.join(" ")).not.toContain("npx");
  });
});
