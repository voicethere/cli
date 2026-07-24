import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  parseVoiceAdvancedSettingValue,
  VOICE_ADVANCED_SETTING_KEYS,
  type VoiceAdvancedSettingKey,
} from "./defs.js";

export interface ProjectsVoiceAdvancedSetOptions {
  name: string;
  value: string;
  projectId?: string;
}

export async function runProjectsVoiceAdvancedSet(
  options: ProjectsVoiceAdvancedSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const key = options.name.trim() as VoiceAdvancedSettingKey;
  if (!VOICE_ADVANCED_SETTING_KEYS.includes(key)) {
    throw new Error(
      `Unknown voice advanced setting ${key}. Valid: ${VOICE_ADVANCED_SETTING_KEYS.join(", ")}`,
    );
  }

  const value = parseVoiceAdvancedSettingValue(key, options.value);
  logStep(`Setting ${key} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.setProjectVoiceAdvancedSetting(
    projectId,
    key,
    value,
  );
  console.log(JSON.stringify(result.settings, null, 2));
}

export interface ProjectsVoiceAdvancedResetOptions {
  projectId?: string;
}

export async function runProjectsVoiceAdvancedReset(
  options: ProjectsVoiceAdvancedResetOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Resetting advanced voice settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.resetProjectVoiceAdvancedSettings(projectId);
  console.log(JSON.stringify(result.settings, null, 2));
}
