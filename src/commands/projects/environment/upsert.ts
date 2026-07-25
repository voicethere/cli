import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsEnvironmentUpsertOptions {
  key: string;
  value: string;
  projectId?: string;
}

export async function runProjectsEnvironmentUpsert(
  options: ProjectsEnvironmentUpsertOptions,
): Promise<void> {
  const key = options.key.trim();
  const value = options.value;
  if (!key) {
    throw new Error("environment key is required");
  }
  if (!value.trim()) {
    throw new Error("environment value is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Saving ${key} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const entry = await api.upsertProjectEnvironmentVariable(
    projectId,
    key,
    value,
  );
  console.log(JSON.stringify(entry, null, 2));
}
