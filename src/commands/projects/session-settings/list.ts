import { createApi } from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export const SESSION_SETTING_KEYS = [
  "error_message",
  "idle_timeout_enabled",
  "idle_timeout_seconds",
  "data_only_idle_timeout_seconds",
  "idle_timeout_voice_activity",
  "idle_timeout_dc_inbound",
] as const;

export type SessionSettingKey = (typeof SESSION_SETTING_KEYS)[number];

export interface ProjectsSessionSettingsListOptions {
  projectId?: string;
}

export async function runProjectsSessionSettingsList(
  options: ProjectsSessionSettingsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing session settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.listProjectSessionSettings(projectId);
  logVerbose(`found ${Object.keys(result.settings).length} setting(s)`);

  for (const key of SESSION_SETTING_KEYS) {
    const value = result.settings[key];
    if (value === undefined) continue;
    console.log(`${key}=${String(value)}`);
  }
}
