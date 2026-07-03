import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
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
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.getProjectSubscription(projectId);
  console.log(JSON.stringify(result, null, 2));
}
