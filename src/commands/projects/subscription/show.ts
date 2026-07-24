import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsSubscriptionShowOptions {
  projectId?: string;
}

export async function runProjectsSubscriptionShow(
  options: ProjectsSubscriptionShowOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading assigned subscription for project ${projectId}`);
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.getProjectSubscription(projectId);
  console.log(JSON.stringify(result, null, 2));
}
