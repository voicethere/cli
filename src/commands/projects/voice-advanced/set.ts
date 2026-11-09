import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  checkConstraintsForSet,
  fallbackDefinition,
  parseVoiceAdvancedValue,
  resolveDefinitions,
} from "./definitions.js";

export interface ProjectsVoiceAdvancedSetOptions {
  name: string;
  value: string;
  projectId?: string;
}

export async function runProjectsVoiceAdvancedSet(
  options: ProjectsVoiceAdvancedSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const key = options.name.trim();
  logStep(`Setting ${key} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const response = await api.listProjectVoiceAdvancedSettings(projectId);

  let def;
  if (response.definitions) {
    def = resolveDefinitions(response).find((d) => d.key === key);
    if (!def) {
      throw new Error(
        `Unknown voice advanced setting ${key}. Valid: ${response.definitions.map((d) => d.key).join(", ")}`,
      );
    }
  } else {
    logVerbose(
      "platform returned no definitions; typing the value from defaults",
    );
    def = fallbackDefinition(key, response);
  }

  const value = parseVoiceAdvancedValue(def, options.value);
  const broken = checkConstraintsForSet(key, value, response);
  if (broken.length > 0) {
    throw new Error(broken.join("\n"));
  }
  await api.setProjectVoiceAdvancedSetting(projectId, key, value);
  console.log(`${key}=${String(value)}`);
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
  const api = createApiFromCredentials(credentials);
  await api.resetProjectVoiceAdvancedSettings(projectId);
  console.log("reset=defaults");
}
