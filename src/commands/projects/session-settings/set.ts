import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  ABSOLUTE_IDLE_TIMEOUT_MAX_SECONDS,
  isIdleTimeoutSecondsKey,
  SESSION_SETTING_DEFS,
  SESSION_SETTING_KEYS,
  type SessionSettingKey,
} from "./defs.js";

function parseValue(
  key: SessionSettingKey,
  raw: string,
): boolean | number | string {
  const def = SESSION_SETTING_DEFS[key];

  if (def.type === "string") {
    return raw.trim().slice(0, 500);
  }

  if (def.type === "boolean") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    throw new Error(`Invalid boolean for ${key}: use true or false`);
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${key}`);
  }
  const min = def.min ?? 0;
  const max = isIdleTimeoutSecondsKey(key)
    ? ABSOLUTE_IDLE_TIMEOUT_MAX_SECONDS
    : (def.max ?? Number.MAX_SAFE_INTEGER);
  if (n < min || n > max) {
    throw new Error(`${key} must be between ${min} and ${max}`);
  }
  return Math.floor(n);
}

export interface ProjectsSessionSettingsSetOptions {
  name: string;
  value: string;
  projectId?: string;
}

export async function runProjectsSessionSettingsSet(
  options: ProjectsSessionSettingsSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const key = options.name.trim() as SessionSettingKey;
  if (!SESSION_SETTING_KEYS.includes(key)) {
    throw new Error(
      `Unknown session setting ${key}. Valid: ${SESSION_SETTING_KEYS.join(", ")}`,
    );
  }

  if (
    key === "idle_timeout_enabled" &&
    (options.value === "false" || options.value === "0")
  ) {
    console.warn(
      "Warning: disabling idle timeout keeps WebRTC sessions billable longer.",
    );
  }

  const value = parseValue(key, options.value);
  logStep(`Setting ${key} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.setProjectSessionSetting(projectId, key, value);
  console.log(JSON.stringify(result.settings, null, 2));
}
