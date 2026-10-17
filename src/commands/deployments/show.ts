import { logStep, logVerbose } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireProjectId } from "../../lib/project-config.js";
import { formatDeploymentTimeline } from "./format.js";

export interface DeploymentsShowOptions {
  projectId?: string;
  json?: boolean;
}

export async function runDeploymentsShow(
  deploymentId: string,
  options: DeploymentsShowOptions = {},
): Promise<void> {
  const id = deploymentId.trim();
  if (!id) {
    throw new Error("deploymentId is required");
  }
  const projectId = options.projectId?.trim() || (await requireProjectId());

  logStep(`Showing deployment ${id}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.getDeploymentEvents(projectId, id);
  logVerbose(`found ${result.events.length} event(s)`);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const line of formatDeploymentTimeline(
    result.deployment,
    result.events,
    result.derived,
  )) {
    console.log(line);
  }
}
