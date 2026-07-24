import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsSecretsDeleteOptions {
  name: string;
  projectId?: string;
}

export async function runProjectsSecretsDelete(
  options: ProjectsSecretsDeleteOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("secret name is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Deleting secret ${name} from project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  await api.deleteProjectSecret(projectId, name);
  console.log(`Deleted secret ${name}`);
}
