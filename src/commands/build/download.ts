import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { type VoicethereApi } from "../../lib/api.js";
import { logCommandInfo, logStep, logVerbose } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { resolveProjectId } from "../../lib/project-config.js";

export interface BuildDownloadOptions {
  output: string;
  buildId?: string;
  startDir?: string;
}

export async function resolveDefaultBuildDownloadId(
  api: VoicethereApi,
  projectId: string,
): Promise<string> {
  logVerbose(`resolving build id for download (project ${projectId})`);
  const [project, builds] = await Promise.all([
    api.getProject(projectId),
    api.listBuilds(projectId),
  ]);

  if (project.active_build_id) {
    return project.active_build_id;
  }

  const newestPassed = builds.find(
    (build) => build.validation_status === "passed",
  );
  if (!newestPassed) {
    throw new Error(
      "No build available to download. Upload and validate a bundle, or pass --build-id.",
    );
  }

  return newestPassed.id;
}

export async function runBuildDownload(
  options: BuildDownloadOptions,
): Promise<void> {
  const output = options.output?.trim();
  if (!output) {
    throw new Error(
      "Output path required. Use: voicethere build download -o <path>",
    );
  }

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const project = await resolveProjectId(
    options.startDir ? { startDir: options.startDir } : undefined,
  );

  const buildId =
    options.buildId?.trim() ||
    (await resolveDefaultBuildDownloadId(api, project.projectId));

  logStep(`Downloading compiled bundle ${buildId}`);
  const { bytes, filename } = await api.getProjectBuildDownload(
    project.projectId,
    buildId,
  );

  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);

  const nameHint = filename ? ` (${filename})` : "";
  logCommandInfo(`wrote ${bytes.length} byte(s) to ${outputPath}${nameHint}`);
  console.log(outputPath);
}
