import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsSecretsCreateOptions {
  name: string;
  value: string;
  projectId?: string;
}

export async function runProjectsSecretsCreate(
  options: ProjectsSecretsCreateOptions,
): Promise<void> {
  const name = options.name.trim();
  const value = options.value;
  if (!name) {
    throw new Error("secret name is required");
  }
  if (!value.trim()) {
    throw new Error("secret value is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Creating secret ${name} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const secret = await api.createProjectSecret(projectId, name, value);
  console.log(JSON.stringify(secret, null, 2));
}
