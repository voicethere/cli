import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const PROJECT_CONFIG_DIR = ".voicethere";
export const PROJECT_CONFIG_FILENAME = "config.json";
export const DEFAULT_BUNDLE = "dist/agent.js";

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

export type BundlePathSource = "argument" | "config" | "default";

export interface ResolvedBundlePath {
  relativePath: string;
  absolutePath: string;
  source: BundlePathSource;
  configPath?: string;
}

export type ProjectIdSource = "config";

export interface ResolvedProjectId {
  projectId: string;
  source: ProjectIdSource;
  configPath: string;
}

export const NO_PROJECT_SELECTED_MESSAGE =
  "No project selected. Commit .voicethere/config.json in this repo or run: voicethere projects use <projectId>";

export function getProjectConfigOverridePath(): string | null {
  const override = process.env.VOICETHERE_PROJECT_CONFIG?.trim();
  return override || null;
}

/** Repo root: parent of `.voicethere/` containing config.json. */
export function repoRootFromConfigPath(configPath: string): string {
  return dirname(dirname(configPath));
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

export async function resolveProjectId(options?: {
  startDir?: string;
}): Promise<ResolvedProjectId> {
  const linked = await readProjectConfig(options?.startDir);
  if (linked?.config.project_id) {
    return {
      projectId: linked.config.project_id,
      source: "config",
      configPath: linked.path,
    };
  }

  throw new Error(NO_PROJECT_SELECTED_MESSAGE);
}

export async function requireProjectId(options?: {
  startDir?: string;
}): Promise<string> {
  const resolved = await resolveProjectId(options);
  return resolved.projectId;
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

/** Bundle path: CLI arg → `.voicethere/config.json` bundle → default `dist/agent.js`. */
export async function resolveBundlePathDetailed(
  fileArg?: string,
  startDir?: string,
): Promise<ResolvedBundlePath> {
  const cwd = resolve(startDir ?? process.cwd());
  const fromArg = fileArg?.trim();

  if (fromArg) {
    return {
      relativePath: fromArg,
      absolutePath: resolve(cwd, fromArg),
      source: "argument",
    };
  }

  const linked = await readProjectConfig(startDir);
  const relativePath = linked?.config.bundle?.trim() || DEFAULT_BUNDLE;
  const baseDir = linked ? repoRootFromConfigPath(linked.path) : cwd;

  return {
    relativePath,
    absolutePath: resolve(baseDir, relativePath),
    source: linked?.config.bundle ? "config" : "default",
    configPath: linked?.path,
  };
}

/** @deprecated Prefer resolveBundlePathDetailed for logging and absolute paths. */
export async function resolveBundlePath(
  fileArg?: string,
  startDir?: string,
): Promise<string> {
  const resolved = await resolveBundlePathDetailed(fileArg, startDir);
  return resolved.absolutePath;
}

export async function assertBundleExists(absolutePath: string): Promise<void> {
  try {
    await access(absolutePath, constants.R_OK);
  } catch {
    throw new Error(
      `Bundle not found or not readable: ${absolutePath} — run: npx @voicethere/agent build`,
    );
  }
}
