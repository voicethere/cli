import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import { SESSION_SETTING_KEYS, type SessionSettingKey } from "./defs.js";

export { SESSION_SETTING_KEYS, type SessionSettingKey };

export interface ProjectsSessionSettingsListOptions {
  projectId?: string;
}

export async function runProjectsSessionSettingsList(
  options: ProjectsSessionSettingsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing session settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectSessionSettings(projectId);
  logVerbose(`found ${Object.keys(result.settings).length} setting(s)`);

  for (const key of SESSION_SETTING_KEYS) {
    const value = result.settings[key];
    if (value === undefined) continue;
    console.log(`${key}=${String(value)}`);
  }
}
