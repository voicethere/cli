import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_BUNDLE,
  findProjectConfigPath,
  parseProjectConfig,
  readProjectConfig,
  requireProjectId,
  resolveBundlePath,
  resolveBundlePathDetailed,
  resolveProjectId,
  writeProjectConfig,
} from "./project-config.js";

describe("project-config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-project-config-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
    delete process.env.VOICETHERE_PROJECT_CONFIG;
  });

  afterEach(async () => {
    delete process.env.VOICETHERE_PROJECT_CONFIG;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("finds config in repo root and nested cwd", async () => {
    const configPath = join(tempDir, ".voicethere", "config.json");
    await mkdir(join(tempDir, ".voicethere"), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({ project_id: "proj-root", bundle: "dist/agent.js" }),
    );

    const nested = join(tempDir, "packages", "agent");
    await mkdir(nested, { recursive: true });

    await expect(findProjectConfigPath(nested)).resolves.toBe(configPath);
  });

  it("uses VOICETHERE_PROJECT_CONFIG override", async () => {
    const override = join(tempDir, "custom-config.json");
    await writeFile(
      override,
      JSON.stringify({ project_id: "proj-override" }),
    );
    process.env.VOICETHERE_PROJECT_CONFIG = override;

    await expect(findProjectConfigPath(tempDir)).resolves.toBe(override);
  });

  it("writes and reads linked project config", async () => {
    const path = await writeProjectConfig(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440000",
        project_slug: "demo-agent",
        name: "Demo Agent",
        bundle: "dist/agent.js",
      },
      { startDir: tempDir },
    );

    const raw = await readFile(path, "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      project_slug: "demo-agent",
    });

    const linked = await readProjectConfig(tempDir);
    expect(linked?.config.project_id).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("resolveProjectId reads selected project from linked config", async () => {
    await writeProjectConfig({ project_id: "from-file" }, { startDir: tempDir });

    await expect(resolveProjectId({ startDir: tempDir })).resolves.toMatchObject(
      {
        projectId: "from-file",
        source: "config",
      },
    );
  });

  it("resolveProjectId fails when no project is selected", async () => {
    await expect(resolveProjectId({ startDir: tempDir })).rejects.toThrow(
      /No project selected/,
    );
  });

  it("requireProjectId returns project id string", async () => {
    await writeProjectConfig({ project_id: "from-file" }, { startDir: tempDir });
    await expect(requireProjectId({ startDir: tempDir })).resolves.toBe(
      "from-file",
    );
  });

  it("resolveBundlePathDetailed uses default relative to cwd when no config", async () => {
    await expect(
      resolveBundlePathDetailed(undefined, tempDir),
    ).resolves.toMatchObject({
      relativePath: DEFAULT_BUNDLE,
      absolutePath: join(tempDir, DEFAULT_BUNDLE),
      source: "default",
    });
  });

  it("resolveBundlePathDetailed uses config bundle relative to repo root", async () => {
    const configPath = await writeProjectConfig(
      {
        project_id: "p1",
        bundle: "build/out.js",
      },
      { startDir: tempDir },
    );

    const nested = join(tempDir, "packages", "agent");
    await mkdir(nested, { recursive: true });

    await expect(
      resolveBundlePathDetailed(undefined, nested),
    ).resolves.toMatchObject({
      relativePath: "build/out.js",
      absolutePath: join(tempDir, "build/out.js"),
      source: "config",
      configPath,
    });
  });

  it("resolveBundlePath returns absolute paths", async () => {
    await writeProjectConfig(
      {
        project_id: "p1",
        bundle: "build/out.js",
      },
      { startDir: tempDir },
    );

    await expect(resolveBundlePath(undefined, tempDir)).resolves.toBe(
      join(tempDir, "build/out.js"),
    );
    await expect(resolveBundlePath("override.js", tempDir)).resolves.toBe(
      join(tempDir, "override.js"),
    );
  });

  it("parseProjectConfig rejects missing project_id", () => {
    expect(() => parseProjectConfig("{}")).toThrow(/project_id/);
  });
});
