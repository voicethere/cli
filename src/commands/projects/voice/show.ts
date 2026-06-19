import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsVoiceShowOptions {
  projectId?: string;
}

export async function runProjectsVoiceShow(
  options: ProjectsVoiceShowOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading voice settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const settings = await api.getProjectVoiceSettings(projectId);

  console.log(JSON.stringify(settings, null, 2));
}
