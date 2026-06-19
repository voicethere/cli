import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import { SESSION_SETTING_KEYS, type SessionSettingKey } from "./list.js";

function parseValue(
  key: SessionSettingKey,
  raw: string,
): boolean | number | string {
  if (key === "error_message") return raw;
  if (
    key === "idle_timeout_enabled" ||
    key === "idle_timeout_voice_activity" ||
    key === "idle_timeout_dc_inbound"
  ) {
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
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.setProjectSessionSetting(projectId, key, value);
  console.log(JSON.stringify(result.settings, null, 2));
}
