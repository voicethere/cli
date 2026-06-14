import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsEnvironmentDeleteOptions {
  key: string;
  projectId?: string;
}

export async function runProjectsEnvironmentDelete(
  options: ProjectsEnvironmentDeleteOptions,
): Promise<void> {
  const key = options.key.trim();
  if (!key) {
    throw new Error("environment key is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Deleting ${key} from project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  await api.deleteProjectEnvironmentVariable(projectId, key);
  console.log(`Deleted ${key}`);
}
