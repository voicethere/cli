import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  describeRange,
  formatVoiceAdvancedSettingLine,
  keysFromSettings,
  resolveDefinitions,
} from "./definitions.js";

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

  if (result.definitions) {
    const defs = resolveDefinitions(result);
    logVerbose(`found ${defs.length} setting key(s)`);
    for (const def of defs) {
      const line = formatVoiceAdvancedSettingLine(
        result.settings,
        def.key,
        def.path,
        def.default,
      );
      if (line) {
        console.log(
          `${line}  (default ${String(def.default)}${describeRange(def)})`,
        );
      }
    }
    return;
  }

  const keys = keysFromSettings(result.settings);
  logVerbose(`found ${keys.length} setting key(s)`);
  for (const key of keys) {
    const line = formatVoiceAdvancedSettingLine(result.settings, key);
    if (line) {
      console.log(line);
    }
  }
}
