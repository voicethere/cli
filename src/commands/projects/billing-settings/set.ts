import { logStep } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import type { UpdateProjectBillingSettingsInput } from "../../../lib/api.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  BILLING_CURRENCY_VALUES,
  BILLING_SETTING_DEFS,
  BILLING_SETTING_KEYS,
  type BillingSettingKey,
} from "./defs.js";

function isClearValue(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === "" || normalized === "null" || normalized === "none";
}

function parseValue(
  key: BillingSettingKey,
  raw: string,
): boolean | number | string | null {
  const def = BILLING_SETTING_DEFS[key];

  if (def.type === "nullable_number") {
    if (isClearValue(raw)) {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(
        `Invalid amount for ${key}: use a positive number or null|none to clear`,
      );
    }
    return Math.round(n * 100) / 100;
  }

  if (def.type === "currency") {
    if (isClearValue(raw)) {
      return null;
    }
    const normalized = raw.trim().toLowerCase();
    if (!BILLING_CURRENCY_VALUES.includes(normalized as "eur" | "usd")) {
      throw new Error(
        `Invalid currency for ${key}: use ${BILLING_CURRENCY_VALUES.join(" or ")}`,
      );
    }
    return normalized;
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

export interface ProjectsBillingSettingsSetOptions {
  name: string;
  value: string;
  projectId?: string;
}

export async function runProjectsBillingSettingsSet(
  options: ProjectsBillingSettingsSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const key = options.name.trim() as BillingSettingKey;
  if (!BILLING_SETTING_KEYS.includes(key)) {
    throw new Error(
      `Unknown billing setting ${key}. Valid: ${BILLING_SETTING_KEYS.join(", ")}`,
    );
  }

  const value = parseValue(key, options.value);
  logStep(`Setting ${key} for project ${projectId}`);

  const patch: UpdateProjectBillingSettingsInput = { [key]: value };
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  await api.updateProjectBillingSettings(projectId, patch);
  console.log(`${key}=${value === null ? "null" : String(value)}`);
}
