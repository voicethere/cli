import { createApi, type Build } from "../../lib/api.js";
import { logBuildPromoteContext, logStep, logVerbose } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { isInteractive, promptChoice } from "../../lib/prompt.js";
import { resolveProjectId } from "../../lib/project-config.js";

export interface BuildPromoteOptions {
  buildId?: string;
}

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function formatBuildChoice(build: Build, activeBuildId: string | null): string {
  const active = activeBuildId === build.id ? " [active]" : "";
  const message = build.message?.replace(/\s+/g, " ").trim();
  const label = message ? `${message} — ` : "";
  return `${label}${build.id} — ${formatUploadedAt(build.created_at)}${active}`;
}

async function resolveBuildId(
  projectId: string,
  buildIdArg?: string,
): Promise<string> {
  const trimmed = buildIdArg?.trim();
  if (trimmed) {
    return trimmed;
  }

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  logVerbose(`loading builds for project ${projectId}`);
  const [project, builds] = await Promise.all([
    api.getProject(projectId),
    api.listBuilds(projectId),
  ]);

  if (builds.length === 0) {
    throw new Error(
      "No builds uploaded yet. Run: voicethere build upload",
    );
  }

  if (!isInteractive()) {
    throw new Error(
      "Build id required in non-interactive mode. Run: voicethere build promote <buildId>",
    );
  }

  return promptChoice(
    "Select a build to promote",
    builds.map((build) => ({
      label: formatBuildChoice(build, project.active_build_id),
      value: build.id,
    })),
  );
}

/**
 * Promote sets the active build in the control plane (platform `POST …/promote`).
 * Does not roll out to cloud runners — use `voicethere deploy` when available.
 */
export async function runBuildPromote(
  options: BuildPromoteOptions,
): Promise<void> {
  logStep("Promoting build to active");
  const project = await resolveProjectId();
  const buildId = await resolveBuildId(project.projectId, options.buildId);
  logBuildPromoteContext(buildId, project);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  logStep("Calling control plane promote API");
  const result = await api.promote(project.projectId, buildId);

  console.log(
    `Promoted build ${result.active_build_id} for project ${result.project_id}`,
  );
  console.log(`Active artifact: ${result.active_storage_path}`);
  console.log(
    "Control plane updated — cloud runner rollout is not available yet (future: voicethere deploy --wait).",
  );
}
