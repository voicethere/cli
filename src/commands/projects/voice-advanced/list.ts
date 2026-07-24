import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  formatVoiceAdvancedSettingLine,
  VOICE_ADVANCED_SETTING_KEYS,
  type VoiceAdvancedSettingKey,
} from "./defs.js";

export interface ProjectsVoiceAdvancedListOptions {
  projectId?: string;
}

export async function runProjectsVoiceAdvancedList(
  options: ProjectsVoiceAdvancedListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing advanced voice settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectVoiceAdvancedSettings(projectId);
  logVerbose(`found ${VOICE_ADVANCED_SETTING_KEYS.length} setting key(s)`);

  for (const key of VOICE_ADVANCED_SETTING_KEYS) {
    const line = formatVoiceAdvancedSettingLine(result.settings, key);
    if (line) {
      console.log(line);
    }
  }
}

export { VOICE_ADVANCED_SETTING_KEYS, type VoiceAdvancedSettingKey };
