import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
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
  const api = createApi(credentials.api_key, credentials.api_base);
  const secret = await api.createProjectSecret(projectId, name, value);
  console.log(JSON.stringify(secret, null, 2));
}
