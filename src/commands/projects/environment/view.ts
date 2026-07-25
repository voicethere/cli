import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsEnvironmentViewOptions {
  key: string;
  projectId?: string;
}

export async function runProjectsEnvironmentView(
  options: ProjectsEnvironmentViewOptions,
): Promise<void> {
  const key = options.key.trim();
  if (!key) {
    throw new Error("environment key is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading ${key} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const entry = await api.getProjectEnvironmentVariable(projectId, key);
  console.log(JSON.stringify(entry, null, 2));
}
