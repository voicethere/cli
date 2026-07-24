import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsEnvironmentListOptions {
  projectId?: string;
}

export async function runProjectsEnvironmentList(
  options: ProjectsEnvironmentListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing environment variables for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectEnvironment(projectId);
  logVerbose(`found ${result.variables.length} variable(s)`);

  if (result.variables.length === 0) {
    console.log("No environment variables.");
    return;
  }

  for (const entry of result.variables) {
    console.log(`${entry.key}=${entry.value}`);
  }
}
