import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createTwoFilesPatch } from "diff";

import { ApiError, type SourceVersionSummary } from "../lib/api.js";
import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import { requireCredentials } from "../lib/config.js";
import { logCommandInfo, logStep } from "../lib/command-log.js";
import { isInteractive, promptYesNo } from "../lib/prompt.js";
import {
  readProjectConfig,
  repoRootFromConfigPath,
  requireProjectId,
  resolveProjectId,
} from "../lib/project-config.js";
import {
  collectWorkspaceSourceFiles,
  resolveWorkspaceEntryPath,
} from "../lib/workspace-files.js";

const MAX_VERSION_MESSAGE_LENGTH = 200;
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

const STALE_SOURCE_MESSAGE =
  "Source changed on the server since you read it. Run voicethere source pull, then try again.";

function parseRevisionArg(raw: string, name: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer of at least 1.`);
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be an integer of at least 1.`);
  }
  return value;
}

async function resolveSourceProjectId(explicit?: string): Promise<string> {
  const id = explicit?.trim();
  if (id) return id;
  return requireProjectId();
}

function rethrowSourceApiError(error: unknown, revision?: number): never {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      throw new Error(STALE_SOURCE_MESSAGE);
    }
    if (error.status === 404 && revision !== undefined) {
      throw new Error(
        `Version ${revision} not found. It may have been removed by your plan's version limit.`,
      );
    }
  }
  throw error;
}

export interface SourcePushOptions {
  message?: string;
}

export async function runSourcePush(
  options: SourcePushOptions = {},
): Promise<void> {
  const message = options.message;
  if (message !== undefined && message.length > MAX_VERSION_MESSAGE_LENGTH) {
    throw new Error(
      `--message must be at most ${MAX_VERSION_MESSAGE_LENGTH} characters (got ${message.length}).`,
    );
  }
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await requireProjectId();
  const linked = await readProjectConfig();
  if (!linked) {
    throw new Error("No .voicethere/config.json found");
  }

  const repoRoot = repoRootFromConfigPath(linked.path);
  logStep(`Collecting workspace files from ${repoRoot}`);
  const files = await collectWorkspaceSourceFiles(repoRoot);

  const remote = await api.getProjectSource(projectId);
  const entryPath = resolveWorkspaceEntryPath(files, remote.entry_path);

  logStep(`Uploading ${files.length} file(s) (revision ${remote.revision})`);
  let updated;
  try {
    updated = await api.putProjectSource(projectId, {
      entry_path: entryPath,
      files,
      revision: remote.revision,
      ...(message !== undefined && message !== "" ? { message } : {}),
    });
  } catch (error) {
    rethrowSourceApiError(error);
  }

  logCommandInfo(`source revision: ${updated.revision}`);
  console.log(String(updated.revision));
}

export async function runSourcePull(): Promise<void> {
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await requireProjectId();
  const linked = await readProjectConfig();
  if (!linked) {
    throw new Error("No .voicethere/config.json found");
  }

  const repoRoot = repoRootFromConfigPath(linked.path);
  logStep("Downloading Code workspace from VoiceThere");
  const remote = await api.getProjectSource(projectId);

  for (const file of remote.files) {
    const absolutePath = join(repoRoot, file.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }

  logCommandInfo(
    `pulled ${remote.files.length} file(s) at revision ${remote.revision}`,
  );
}

export interface SourceDownloadOptions {
  output: string;
  projectId?: string;
  startDir?: string;
}

export async function runSourceDownload(
  options: SourceDownloadOptions,
): Promise<void> {
  const output = options.output?.trim();
  if (!output) {
    throw new Error(
      "Output path required. Use: voicethere source download -o <path>",
    );
  }

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const explicitId = options.projectId?.trim();
  const project = explicitId
    ? { projectId: explicitId }
    : await resolveProjectId(
        options.startDir ? { startDir: options.startDir } : undefined,
      );

  logStep("Downloading Code workspace zip from VoiceThere");
  const { bytes, filename } = await api.getProjectSourceDownload(
    project.projectId,
  );

  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);

  const nameHint = filename ? ` (${filename})` : "";
  logCommandInfo(`wrote ${bytes.length} byte(s) to ${outputPath}${nameHint}`);
  console.log(outputPath);
}

export interface SourceHistoryOptions {
  limit?: number;
  json?: boolean;
  projectId?: string;
}

export async function runSourceHistory(
  options: SourceHistoryOptions = {},
): Promise<void> {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new Error(
      `--limit must be an integer from 1 to ${MAX_HISTORY_LIMIT}.`,
    );
  }
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await resolveSourceProjectId(options.projectId);

  const versions: SourceVersionSummary[] = [];
  let before: number | undefined;
  while (versions.length < limit) {
    const page = await api.listProjectSourceVersions(projectId, {
      limit: Math.min(limit - versions.length, MAX_HISTORY_LIMIT),
      ...(before !== undefined ? { before } : {}),
    });
    versions.push(...page.versions);
    if (page.next_before === null || page.versions.length === 0) break;
    before = page.next_before;
  }
  const shown = versions.slice(0, limit);

  if (options.json) {
    console.log(JSON.stringify(shown, null, 2));
    return;
  }

  const rows = [
    ["", "REVISION", "WHEN (ISO)", "SOURCE", "FILES", "BUILDS", "MESSAGE"],
    ...shown.map((v) => [
      v.is_current ? "*" : "",
      String(v.revision),
      v.created_at,
      v.source,
      String(v.file_count),
      String(v.build_ids.length),
      v.message ?? "",
    ]),
  ];
  const widths = rows[0]!.map((_, col) =>
    Math.max(...rows.map((row) => row[col]!.length)),
  );
  for (const row of rows) {
    console.log(
      row
        .map((cell, col) => cell.padEnd(widths[col]!))
        .join("  ")
        .trimEnd(),
    );
  }
}

export interface SourceDiffOptions {
  nameOnly?: boolean;
  projectId?: string;
}

export async function runSourceDiff(
  fromArg: string,
  toArg: string | undefined,
  options: SourceDiffOptions = {},
): Promise<void> {
  const from = parseRevisionArg(fromArg, "from");
  const explicitTo =
    toArg === undefined ? undefined : parseRevisionArg(toArg, "to");
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await resolveSourceProjectId(options.projectId);

  const to = explicitTo ?? (await api.getProjectSource(projectId)).revision;

  let diff;
  try {
    diff = await api.diffProjectSourceVersions(projectId, from, to);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(
        `Version ${from} or ${to} not found. It may have been removed by your plan's version limit.`,
      );
    }
    throw error;
  }

  const changed = diff.files.filter((file) => file.status !== "unchanged");
  if (changed.length === 0) {
    console.log("No differences.");
    return;
  }
  if (options.nameOnly) {
    for (const file of changed) {
      console.log(`${file.status} ${file.path}`);
    }
    return;
  }
  for (const file of changed) {
    process.stdout.write(
      createTwoFilesPatch(
        `a/${file.path}`,
        `b/${file.path}`,
        file.before ?? "",
        file.after ?? "",
        `version ${diff.from}`,
        `version ${diff.to}`,
      ),
    );
  }
}

export interface SourceRestoreOptions {
  yes?: boolean;
  projectId?: string;
}

export async function runSourceRestore(
  revisionArg: string,
  options: SourceRestoreOptions = {},
): Promise<void> {
  const revision = parseRevisionArg(revisionArg, "revision");
  if (!options.yes && !isInteractive()) {
    throw new Error("Pass --yes to restore without a prompt.");
  }
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await resolveSourceProjectId(options.projectId);

  const current = await api.getProjectSource(projectId);
  if (!options.yes) {
    const confirmed = await promptYesNo(
      `Restore version ${revision}? The current files are kept as version ${current.revision}.`,
    );
    if (!confirmed) {
      throw new Error("Restore cancelled.");
    }
  }

  logStep(`Restoring version ${revision}`);
  let restored;
  try {
    restored = await api.restoreProjectSourceVersion(
      projectId,
      revision,
      current.revision,
    );
  } catch (error) {
    rethrowSourceApiError(error, revision);
  }
  console.log(String(restored.revision));
  logCommandInfo("Run voicethere source pull to update local files.");
}
