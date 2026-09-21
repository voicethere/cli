import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import { requireCredentials } from "../lib/config.js";
import { logCommandInfo, logStep } from "../lib/command-log.js";
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

export async function runSourcePush(): Promise<void> {
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
  const updated = await api.putProjectSource(projectId, {
    entry_path: entryPath,
    files,
    revision: remote.revision,
  });

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
  const project = await resolveProjectId(
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
