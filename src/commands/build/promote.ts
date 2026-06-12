import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface BuildPromoteOptions {
  project?: string;
  buildId: string;
}

/**
 * Promote sets the active build in the control plane (platform `POST …/promote`).
 * Does not roll out to cluster runners — use `voicethere deploy` when P5 lands.
 */
export async function runBuildPromote(options: BuildPromoteOptions): Promise<void> {
  const buildId = options.buildId.trim();
  if (!buildId) {
    throw new Error(
      "Build ID is required. Usage: voicethere build promote <buildId>",
    );
  }

  const projectId = await requireProjectId({ projectFlag: options.project });
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  const result = await api.promote(projectId, buildId);

  console.log(
    `Promoted build ${result.active_build_id} for project ${result.project_id}`,
  );
  console.log(`Active artifact: ${result.active_storage_path}`);
  console.log(
    "Control plane only — cluster rollout is not configured yet (future: voicethere deploy --wait).",
  );
}
