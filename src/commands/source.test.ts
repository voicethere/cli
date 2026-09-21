import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSourceDownload, runSourcePull, runSourcePush } from "./source.js";

const getProjectSource = vi.fn();
const getProjectSourceDownload = vi.fn();
const putProjectSource = vi.fn();
const requireCredentials = vi.fn();

vi.mock("../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    getProjectSource,
    getProjectSourceDownload,
    putProjectSource,
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
});
