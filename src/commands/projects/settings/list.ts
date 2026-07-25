import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export const PROJECT_SETTING_KEYS = [
  "mode",
  "warm_pool_enabled",
  "redis_enabled",
  "idle_scale_down_seconds",
  "data_only",
  "shared_child_per_session",
  "agent_crash_policy",
  "agent_child_ipc_debug",
] as const;

export type ProjectSettingKey = (typeof PROJECT_SETTING_KEYS)[number];

export interface ProjectsSettingsListOptions {
  projectId?: string;
}

export async function runProjectsSettingsList(
  options: ProjectsSettingsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing runner settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectSettings(projectId);
  logVerbose(`found ${Object.keys(result.settings).length} setting(s)`);

  for (const key of PROJECT_SETTING_KEYS) {
    const value = result.settings[key];
    console.log(`${key}=${String(value)}`);
  }
}
