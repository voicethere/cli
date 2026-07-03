import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import { PROJECT_SETTING_KEYS, type ProjectSettingKey } from "./list.js";

function parseSettingValue(
  key: ProjectSettingKey,
  raw: string,
): boolean | number | string {
  if (key === "mode") {
    const normalized = raw.trim();
    if (
      normalized === "voice" ||
      normalized === "data" ||
      normalized === "voice+data"
    ) {
      return normalized;
    }
    throw new Error("Invalid mode: use voice, data, or voice+data");
  }

  if (key === "agent_crash_policy") {
    const normalized = raw.trim();
    if (normalized === "disconnect_all" || normalized === "restart_child") {
      return normalized;
    }
    throw new Error(
      "Invalid agent_crash_policy: use disconnect_all or restart_child",
    );
  }

  if (key === "idle_scale_down_seconds") {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid number for ${key}`);
    }
    const min = 60;
    const max = 86_400;
    if (n < min || n > max) {
      throw new Error(`${key} must be between ${min} and ${max}`);
    }
    return Math.floor(n);
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new Error(`Invalid boolean for ${key}: use true or false`);
}

export interface ProjectsSettingsSetOptions {
  projectId?: string;
  name: string;
  value: string;
}

export async function runProjectsSettingsSet(
  options: ProjectsSettingsSetOptions,
): Promise<void> {
  const name = options.name?.trim();
  if (!name) {
    throw new Error("setting name is required");
  }
  if (!(PROJECT_SETTING_KEYS as readonly string[]).includes(name)) {
    throw new Error(
      `Unknown setting ${name}; allowed: ${PROJECT_SETTING_KEYS.join(", ")}`,
    );
  }

  const rawValue = options.value?.trim();
  if (rawValue === undefined || rawValue === "") {
    throw new Error("setting value is required");
  }

  const key = name as ProjectSettingKey;
  const parsed = parseSettingValue(key, rawValue);

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Setting ${key}=${String(parsed)} on project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.setProjectSetting(projectId, key, parsed);

  console.log(JSON.stringify(result.settings, null, 2));
}
