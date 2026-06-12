import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const PROJECT_CONFIG_DIR = ".voicethere";
export const PROJECT_CONFIG_FILENAME = "config.json";

export interface ProjectConfig {
  /** Platform project UUID — safe to commit; links this repo to a cloud project. */
  project_id: string;
  project_slug?: string;
  name?: string;
  /** Default bundle path for build validate/upload (relative to repo root). */
  bundle?: string;
}

export interface ProjectConfigFile {
  version?: number;
  project_id: string;
  project_slug?: string;
  name?: string;
  bundle?: string;
}

export function getProjectConfigOverridePath(): string | null {
  const override = process.env.VOICETHERE_PROJECT_CONFIG?.trim();
  return override || null;
}

/** Walk upward from startDir to find `.voicethere/config.json`. */
export async function findProjectConfigPath(
  startDir: string = process.cwd(),
): Promise<string | null> {
  const override = getProjectConfigOverridePath();
  if (override) {
    try {
      await access(override);
      return resolve(override);
    } catch {
      return null;
    }
  }

  let dir = resolve(startDir);
  const root = resolve("/");

  while (true) {
    const candidate = join(dir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILENAME);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue upward
    }

    if (dir === root) {
      return null;
    }
    dir = dirname(dir);
  }
}

export function parseProjectConfig(raw: string): ProjectConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in .voicethere/config.json");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(".voicethere/config.json must be a JSON object");
  }

  const record = parsed as ProjectConfigFile;
  const projectId = record.project_id?.trim();

  if (!projectId) {
    throw new Error(".voicethere/config.json requires project_id");
  }

  return {
    project_id: projectId,
    project_slug: record.project_slug?.trim() || undefined,
    name: record.name?.trim() || undefined,
    bundle: record.bundle?.trim() || undefined,
  };
}

export async function readProjectConfig(
  startDir?: string,
): Promise<{ config: ProjectConfig; path: string } | null> {
  const path = await findProjectConfigPath(startDir);
  if (!path) {
    return null;
  }

  const raw = await readFile(path, "utf8");
  return { config: parseProjectConfig(raw), path };
}

export async function requireProjectId(options: {
  projectFlag?: string;
  startDir?: string;
}): Promise<string> {
  const fromFlag = options.projectFlag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  const linked = await readProjectConfig(options.startDir);
  if (linked?.config.project_id) {
    return linked.config.project_id;
  }

  throw new Error(
    "No project selected. Pass --project <id> or run: voicethere projects use --project <id>",
  );
}

export async function writeProjectConfig(
  config: ProjectConfig,
  options: { startDir?: string; path?: string } = {},
): Promise<string> {
  const dir = resolve(options.startDir ?? process.cwd());
  const path =
    options.path ?? join(dir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILENAME);

  const payload: ProjectConfigFile = {
    version: 1,
    project_id: config.project_id,
  };

  if (config.project_slug) {
    payload.project_slug = config.project_slug;
  }
  if (config.name) {
    payload.name = config.name;
  }
  if (config.bundle) {
    payload.bundle = config.bundle;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

const DEFAULT_BUNDLE = "dist/agent.js";

/** Bundle path: CLI flag → `.voicethere/config.json` → default. */
export async function resolveBundlePath(
  fileFlag?: string,
  startDir?: string,
): Promise<string> {
  const fromFlag = fileFlag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  const linked = await readProjectConfig(startDir);
  if (linked?.config.bundle) {
    return linked.config.bundle;
  }

  return DEFAULT_BUNDLE;
}
