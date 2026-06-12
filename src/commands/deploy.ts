import { createApi } from "../lib/api.js";
import { requireCredentials } from "../lib/config.js";
import { requireProjectId } from "../lib/project-config.js";

export interface DeployOptions {
  project?: string;
  build?: string;
}

/**
 * Deploy activates a build (platform `POST …/promote`).
 * Default: newest passed build — usually the latest upload.
 */
export async function runDeploy(options: DeployOptions): Promise<void> {
  const projectId = await requireProjectId({ projectFlag: options.project });
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  const result = await api.promote(projectId, options.build?.trim());

  console.log(
    `Deployed build ${result.active_build_id} for project ${result.project_id}`,
  );
  console.log(`Active artifact: ${result.active_storage_path}`);
}
