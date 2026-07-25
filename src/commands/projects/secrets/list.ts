import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsSecretsListOptions {
  projectId?: string;
}

export async function runProjectsSecretsList(
  options: ProjectsSecretsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing secrets for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectSecrets(projectId);
  logVerbose(`found ${result.secrets.length} secret(s)`);

  if (result.secrets.length === 0) {
    console.log("No secrets.");
    return;
  }

  for (const entry of result.secrets) {
    console.log(`${entry.name}\t${entry.masked_value}`);
  }
}
