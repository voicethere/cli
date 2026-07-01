import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsSubscriptionSetOptions {
  projectId?: string;
  subscriptionId: string;
}

function parseSubscriptionId(input: string): string | null {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error("subscription id is required");
  }
  if (normalized === "none" || normalized === "null") {
    return null;
  }
  return normalized;
}

export async function runProjectsSubscriptionSet(
  options: ProjectsSubscriptionSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const subscriptionId = parseSubscriptionId(options.subscriptionId);
  logStep(
    `${subscriptionId ? "Assigning" : "Clearing"} subscription for project ${projectId}`,
  );
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const result = await api.setProjectSubscription(projectId, subscriptionId);
  console.log(JSON.stringify(result, null, 2));
}
