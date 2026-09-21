import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as initModule from "./init.js";
import { runInit } from "./init.js";

const createProject = vi.fn();
const getProjectSource = vi.fn();
const putProjectSource = vi.fn();
const requireCredentials = vi.fn();
const writeProjectConfig = vi.fn();

vi.mock("../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    createProject,
    getProjectSource,
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
    writeProjectConfig: (...args: unknown[]) => writeProjectConfig(...args),
  };
});

describe("runInit", () => {
  let tempDir: string;
  let runNpmInstallSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `voicethere-init-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });

    createProject.mockReset();
    getProjectSource.mockReset();
    putProjectSource.mockReset();
    requireCredentials.mockReset();
    writeProjectConfig.mockReset();
    runNpmInstallSpy = vi
      .spyOn(initModule, "runNpmInstall")
      .mockResolvedValue(undefined);

    vi.spyOn(console, "error").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });
    createProject.mockResolvedValue({
      id: "proj-init",
      org_id: "org-1",
      name: "My Agent",
      slug: "my-agent",
      active_build_id: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    getProjectSource.mockResolvedValue({
      project_id: "proj-init",
      entry_path: "",
      files: [],
      revision: 0,
    });
    putProjectSource.mockResolvedValue({
      project_id: "proj-init",
      entry_path: "echo/agent.ts",
      files: [],
      revision: 1,
    });
    writeProjectConfig.mockResolvedValue(
      join(tempDir, ".voicethere", "config.json"),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes echo workspace locally without cloud calls", async () => {
    const target = join(tempDir, "echo-local");
    await runInit({
      dir: target,
      name: "Echo Local",
      template: "echo",
      localOnly: true,
      noInstall: true,
    });

    expect(createProject).not.toHaveBeenCalled();
    expect(writeProjectConfig).not.toHaveBeenCalled();
    expect(runNpmInstallSpy).not.toHaveBeenCalled();

    const packageJson = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(packageJson.dependencies["@voicethere/agent"]).toBe("^0.8.0");
    expect(packageJson.scripts.verify).toContain("echo/agent.ts");
    expect(packageJson.scripts.upload).toBe("voicethere build upload");
    expect(packageJson.scripts["source:push"]).toBe("voicethere source push");

    await expect(access(join(target, "echo", "agent.ts"))).resolves.toBeUndefined();
    await expect(access(join(target, ".gitignore"))).resolves.toBeUndefined();
    await expect(
      access(join(target, ".voicethere", "config.json")),
    ).rejects.toThrow();
  });

  it("adds ioredis for game-sync template", async () => {
    const target = join(tempDir, "game-sync-local");
    await runInit({
      dir: target,
      template: "game-sync",
      localOnly: true,
      noInstall: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies.ioredis).toBe("^5.11.1");
  });

  it("writes world-sync JSON template under world-sync/agent.ts", async () => {
    const target = join(tempDir, "world-sync-local");
    await runInit({
      dir: target,
      template: "world-sync",
      localOnly: true,
      noInstall: true,
    });

    const packageJson = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string>; scripts: Record<string, string> };
    expect(packageJson.dependencies["@voicethere/agent"]).toBe("^0.8.0");
    expect(packageJson.scripts.build).toContain("world-sync/agent.ts");
    await expect(
      access(join(target, "world-sync", "agent.ts")),
    ).resolves.toBeUndefined();
  });

  it("rejects e2e-only redis-sync as a create template", async () => {
    await expect(
      runInit({
        dir: join(tempDir, "redis-sync-local"),
        template: "redis-sync",
        localOnly: true,
        noInstall: true,
      }),
    ).rejects.toThrow(/e2e-only template/);
  });

  it("writes webhooks and webhooks-redis product templates", async () => {
    const webhooksDir = join(tempDir, "webhooks-local");
    await runInit({
      dir: webhooksDir,
      template: "webhooks",
      localOnly: true,
      noInstall: true,
    });
    await expect(
      access(join(webhooksDir, "webhooks", "agent.ts")),
    ).resolves.toBeUndefined();

    const redisDir = join(tempDir, "webhooks-redis-local");
    await runInit({
      dir: redisDir,
      template: "webhooks-redis",
      localOnly: true,
      noInstall: true,
    });
    const packageJson = JSON.parse(
      await readFile(join(redisDir, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies.ioredis).toBe("^5.11.1");
  });

  it("scaffolds every product template from the installed agent registry", async () => {
    const { listTemplates } = await import("@voicethere/agent/templates");
    for (const template of listTemplates({ kind: "product" })) {
      const target = join(tempDir, `all-${template.id}`);
      await runInit({
        dir: target,
        template: template.id,
        localOnly: true,
        noInstall: true,
      });
      await expect(access(join(target, template.entry))).resolves.toBeUndefined();
    }
  });

  it("writes blank stub with agent.ts entry", async () => {
    const target = join(tempDir, "blank-local");
    await runInit({
      dir: target,
      template: "blank",
      localOnly: true,
      noInstall: true,
    });

    const agentSource = await readFile(join(target, "agent.ts"), "utf8");
    expect(agentSource).toContain("defineAgent");

    const packageJson = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts.build).toContain("--entry agent.ts");
  });

  it("creates cloud project, config, and seeds source", async () => {
    const target = join(tempDir, "cloud-echo");
    getProjectSource.mockResolvedValueOnce({
      project_id: "proj-init",
      entry_path: "echo/agent.ts",
      files: [{ path: "echo/agent.ts", content: "seed" }],
      revision: 1,
    });

    await runInit({
      dir: target,
      name: "Cloud Echo",
      template: "echo",
      noInstall: true,
    });

    expect(createProject).toHaveBeenCalledWith(
      "Cloud Echo",
      "cloud-echo",
      "echo",
    );
    expect(writeProjectConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "proj-init",
        bundle: "dist/agent.js",
      }),
      { startDir: target },
    );
    expect(getProjectSource).toHaveBeenCalledWith("proj-init");
    expect(putProjectSource).toHaveBeenCalledWith(
      "proj-init",
      expect.objectContaining({
        entry_path: "echo/agent.ts",
        revision: 1,
        files: expect.arrayContaining([
          expect.objectContaining({ path: "package.json" }),
        ]),
      }),
    );
  });

  it("refuses existing package.json without --force", async () => {
    const target = join(tempDir, "existing");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "package.json"), "{}\n", "utf8");

    await expect(
      runInit({ dir: target, localOnly: true, noInstall: true }),
    ).rejects.toThrow(/already exists/);
  });
});
