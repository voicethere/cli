import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import type { ProjectBillingSettingsResponse } from "../../../lib/api.js";
import {
  BILLING_LIST_CONTEXT_KEYS,
  BILLING_SETTING_KEYS,
  type BillingListContextKey,
  type BillingSettingKey,
} from "./defs.js";

export { BILLING_SETTING_KEYS, type BillingSettingKey };

function formatListValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  return String(value);
}

export interface ProjectsBillingSettingsListOptions {
  projectId?: string;
}

export async function runProjectsBillingSettingsList(
  options: ProjectsBillingSettingsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Listing billing settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.getProjectBillingSettings(projectId);
  logVerbose(`loaded billing settings for project ${projectId}`);

  for (const key of BILLING_SETTING_KEYS) {
    const value = result[key];
    console.log(`${key}=${formatListValue(value)}`);
  }

  for (const key of BILLING_LIST_CONTEXT_KEYS) {
    const value = result[key as BillingListContextKey];
    console.log(`${key}=${formatListValue(value)}`);
  }
}

export type { ProjectBillingSettingsResponse };
