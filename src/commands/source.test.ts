import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api.js";
import {
  runSourceDiff,
  runSourceDownload,
  runSourceHistory,
  runSourcePull,
  runSourcePush,
  runSourceRestore,
} from "./source.js";

const getProjectSource = vi.fn();
const getProjectSourceDownload = vi.fn();
const putProjectSource = vi.fn();
const requireCredentials = vi.fn();
const listProjectSourceVersions = vi.fn();
const diffProjectSourceVersions = vi.fn();
const restoreProjectSourceVersion = vi.fn();
const promptYesNo = vi.fn();
let interactive = false;

vi.mock("../lib/prompt.js", () => ({
  isInteractive: () => interactive,
  promptYesNo: (...args: unknown[]) => promptYesNo(...args),
}));

vi.mock("../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    getProjectSource,
    getProjectSourceDownload,
    putProjectSource,
    listProjectSourceVersions,
    diffProjectSourceVersions,
    restoreProjectSourceVersion,
  })),
}));

vi.mock("../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../lib/project-config.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/project-config.js")>();
  return {
    ...actual,
    requireProjectId: vi.fn(async () => "proj-src"),
    resolveProjectId: vi.fn(async () => ({
      projectId: "proj-src",
      source: "config",
      configPath: "",
    })),
    readProjectConfig: vi.fn(async () => ({
      config: { project_id: "proj-src" },
      path: "",
    })),
  };
});

describe("source push/pull", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-source-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    configPath = join(tempDir, ".voicethere", "config.json");
    await mkdir(join(tempDir, ".voicethere"), { recursive: true });
    await writeFile(
      configPath,
      `${JSON.stringify({ version: 1, project_id: "proj-src" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(tempDir, "package.json"),
      `${JSON.stringify(
        {
          scripts: {
            build:
              "npx @voicethere/agent build --entry echo.ts --outfile dist/agent.js",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(join(tempDir, "echo.ts"), "export {};\n", "utf8");

    const { readProjectConfig } = await import("../lib/project-config.js");
    vi.mocked(readProjectConfig).mockResolvedValue({
      config: { project_id: "proj-src" },
      path: configPath,
    });

    const { resolveProjectId } = await import("../lib/project-config.js");
    vi.mocked(resolveProjectId).mockClear();

    getProjectSource.mockReset();
    getProjectSourceDownload.mockReset();
    putProjectSource.mockReset();
    listProjectSourceVersions.mockReset();
    diffProjectSourceVersions.mockReset();
    restoreProjectSourceVersion.mockReset();
    promptYesNo.mockReset();
    interactive = false;
    requireCredentials.mockReset();
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("source push sends GET then PUT with revision from GET", async () => {
    getProjectSource.mockResolvedValue({
      project_id: "proj-src",
      entry_path: "echo.ts",
      files: [],
      revision: 4,
    });
    putProjectSource.mockResolvedValue({
      project_id: "proj-src",
      entry_path: "echo.ts",
      files: [],
      revision: 5,
    });

    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await runSourcePush();
    } finally {
      process.chdir(previousCwd);
    }

    expect(getProjectSource).toHaveBeenCalledWith("proj-src");
    expect(putProjectSource).toHaveBeenCalledWith(
      "proj-src",
      expect.objectContaining({
        entry_path: "echo.ts",
        revision: 4,
        files: expect.arrayContaining([
          expect.objectContaining({ path: "echo.ts" }),
          expect.objectContaining({ path: "package.json" }),
        ]),
      }),
    );
    expect(console.log).toHaveBeenCalledWith("5");
  });

  it("source pull writes files from GET payload", async () => {
    getProjectSource.mockResolvedValue({
      project_id: "proj-src",
      entry_path: "agent.ts",
      revision: 2,
      files: [
        { path: "agent.ts", content: "defineAgent({});\n" },
        { path: "helpers/util.ts", content: "export const x = 1;\n" },
      ],
    });

    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await runSourcePull();
    } finally {
      process.chdir(previousCwd);
    }

    expect(await readFile(join(tempDir, "agent.ts"), "utf8")).toBe(
      "defineAgent({});\n",
    );
    expect(await readFile(join(tempDir, "helpers", "util.ts"), "utf8")).toBe(
      "export const x = 1;\n",
    );
  });

  it("source download writes zip bytes to --output", async () => {
    const zip = Buffer.from("PK\x03\x04workspace");
    getProjectSourceDownload.mockResolvedValue({
      bytes: zip,
      filename: "demo-source-r1.zip",
    });

    const outPath = join(tempDir, "out", "workspace.zip");
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await runSourceDownload({ output: outPath });
    } finally {
      process.chdir(previousCwd);
    }

    expect(getProjectSourceDownload).toHaveBeenCalledWith("proj-src");
    expect(await readFile(outPath)).toEqual(zip);
  });

  it("source download uses explicit project id when provided", async () => {
    const { resolveProjectId } = await import("../lib/project-config.js");
    const zip = Buffer.from("PK\x03\x04explicit");
    getProjectSourceDownload.mockResolvedValue({
      bytes: zip,
      filename: "other.zip",
    });

    const outPath = join(tempDir, "explicit.zip");
    await runSourceDownload({
      output: outPath,
      projectId: "proj-explicit",
    });

    expect(resolveProjectId).not.toHaveBeenCalled();
    expect(getProjectSourceDownload).toHaveBeenCalledWith("proj-explicit");
    expect(await readFile(outPath)).toEqual(zip);
  });
  const version = (revision: number, current = false) => ({
    revision,
    created_at: `2026-11-0${revision}T10:00:00Z`,
    source: "cli",
    message: revision === 2 ? "second" : null,
    actor: {
      type: "api_key",
      user_id: null,
      api_key_id: "k",
      user_api_key_id: null,
    },
    entry_path: "echo.ts",
    file_count: 2,
    total_bytes: 10,
    build_ids: revision === 2 ? ["b1"] : [],
    is_current: current,
  });

  function logged(): string {
    return vi
      .mocked(console.log)
      .mock.calls.map((call) => String(call[0]))
      .join("\n");
  }

  it("source history prints every row with the current marker and follows next_before", async () => {
    listProjectSourceVersions
      .mockResolvedValueOnce({
        versions: [version(3, true), version(2)],
        next_before: 2,
      })
      .mockResolvedValueOnce({ versions: [version(1)], next_before: null });
    await runSourceHistory({ limit: 3 });
    expect(listProjectSourceVersions).toHaveBeenNthCalledWith(1, "proj-src", {
      limit: 3,
    });
    expect(listProjectSourceVersions).toHaveBeenNthCalledWith(2, "proj-src", {
      limit: 1,
      before: 2,
    });
    const out = logged().split("\n");
    expect(out[0]).toMatch(
      /REVISION\s+WHEN \(ISO\)\s+SOURCE\s+FILES\s+BUILDS\s+MESSAGE/,
    );
    expect(out[1]).toMatch(/^\*\s+3\s/);
    expect(out[2]).toMatch(/^\s+2\s.*second/);
    expect(out[3]).toMatch(/^\s+1\s/);
  });

  it("source history --json prints a parseable versions array", async () => {
    listProjectSourceVersions.mockResolvedValueOnce({
      versions: [version(2, true)],
      next_before: null,
    });
    await runSourceHistory({ json: true });
    const parsed = JSON.parse(logged());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].revision).toBe(2);
  });

  it("source diff prints ---/+++ headers for a modified file", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    diffProjectSourceVersions.mockResolvedValue({
      from: 1,
      to: 3,
      entry_path_from: "echo.ts",
      entry_path_to: "echo.ts",
      files: [
        { path: "echo.ts", status: "modified", before: "a\n", after: "b\n" },
        { path: "same.ts", status: "unchanged", before: "x", after: "x" },
      ],
    });
    getProjectSource.mockResolvedValue({ revision: 3 });
    await runSourceDiff("1", undefined);
    expect(diffProjectSourceVersions).toHaveBeenCalledWith("proj-src", 1, 3);
    const out = write.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("--- a/echo.ts");
    expect(out).toContain("+++ b/echo.ts");
    expect(out).toContain("-a");
    expect(out).toContain("+b");
    expect(out).not.toContain("same.ts");
  });

  it("source diff prints No differences. for equal versions", async () => {
    diffProjectSourceVersions.mockResolvedValue({
      from: 1,
      to: 2,
      entry_path_from: "echo.ts",
      entry_path_to: "echo.ts",
      files: [
        { path: "echo.ts", status: "unchanged", before: "x", after: "x" },
      ],
    });
    await runSourceDiff("1", "2");
    expect(getProjectSource).not.toHaveBeenCalled();
    expect(logged()).toBe("No differences.");
  });

  it("source diff --name-only prints status and path", async () => {
    diffProjectSourceVersions.mockResolvedValue({
      from: 1,
      to: 2,
      entry_path_from: "echo.ts",
      entry_path_to: "echo.ts",
      files: [
        { path: "a.ts", status: "added", before: null, after: "x" },
        { path: "b.ts", status: "removed", before: "y", after: null },
        { path: "c.ts", status: "unchanged", before: "z", after: "z" },
      ],
    });
    await runSourceDiff("1", "2", { nameOnly: true });
    expect(logged()).toBe("added a.ts\nremoved b.ts");
  });

  it("source diff maps 404 to the pruned-version message", async () => {
    diffProjectSourceVersions.mockRejectedValue(new ApiError(404, "not found"));
    await expect(runSourceDiff("1", "2")).rejects.toThrow(
      "Version 1 not found. It may have been removed by your plan's version limit.",
    );
  });

  it("source restore without a TTY and without --yes sends no request", async () => {
    await expect(runSourceRestore("2")).rejects.toThrow(
      "Pass --yes to restore without a prompt.",
    );
    expect(getProjectSource).not.toHaveBeenCalled();
    expect(restoreProjectSourceVersion).not.toHaveBeenCalled();
  });

  it("source restore --yes sends the current revision and prints the new one", async () => {
    getProjectSource.mockResolvedValue({ revision: 5 });
    restoreProjectSourceVersion.mockResolvedValue({ revision: 6 });
    await runSourceRestore("2", { yes: true });
    expect(restoreProjectSourceVersion).toHaveBeenCalledWith("proj-src", 2, 5);
    expect(promptYesNo).not.toHaveBeenCalled();
    expect(logged()).toBe("6");
  });

  it("source restore asks for confirmation on a TTY and stops on no", async () => {
    interactive = true;
    getProjectSource.mockResolvedValue({ revision: 5 });
    promptYesNo.mockResolvedValue(false);
    await expect(runSourceRestore("2")).rejects.toThrow("Restore cancelled.");
    expect(promptYesNo).toHaveBeenCalledWith(
      "Restore version 2? The current files are kept as version 5.",
    );
    expect(restoreProjectSourceVersion).not.toHaveBeenCalled();
  });

  it("source restore maps 409 to the stale-source message", async () => {
    getProjectSource.mockResolvedValue({ revision: 5 });
    restoreProjectSourceVersion.mockRejectedValue(
      new ApiError(409, "conflict"),
    );
    await expect(runSourceRestore("2", { yes: true })).rejects.toThrow(
      "Source changed on the server since you read it. Run voicethere source pull, then try again.",
    );
  });

  it("non-integer revisions fail before any request", async () => {
    await expect(runSourceRestore("abc", { yes: true })).rejects.toThrow(
      "revision must be an integer of at least 1.",
    );
    await expect(runSourceRestore("0", { yes: true })).rejects.toThrow();
    await expect(runSourceDiff("1.5", "2")).rejects.toThrow();
    await expect(runSourceDiff("1", "x")).rejects.toThrow();
    expect(requireCredentials).not.toHaveBeenCalled();
  });

  it("source push --message over 200 characters fails before any request", async () => {
    await expect(runSourcePush({ message: "x".repeat(201) })).rejects.toThrow(
      "at most 200",
    );
    expect(getProjectSource).not.toHaveBeenCalled();
    expect(putProjectSource).not.toHaveBeenCalled();
  });

  it("source push --message sends the message and maps 409", async () => {
    getProjectSource.mockResolvedValue({
      entry_path: "echo.ts",
      files: [],
      revision: 4,
    });
    putProjectSource.mockResolvedValueOnce({ revision: 5 });
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      await runSourcePush({ message: "tune greeting" });
      expect(putProjectSource).toHaveBeenCalledWith(
        "proj-src",
        expect.objectContaining({ message: "tune greeting", revision: 4 }),
      );
      putProjectSource.mockRejectedValueOnce(new ApiError(409, "conflict"));
      await expect(runSourcePush()).rejects.toThrow(
        "Source changed on the server since you read it. Run voicethere source pull, then try again.",
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
