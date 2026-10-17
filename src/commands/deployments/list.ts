import { logStep, logVerbose } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireProjectId } from "../../lib/project-config.js";
import { parseIsoFlag } from "../projects/metrics/range.js";
import { formatDeploymentList } from "./format.js";

export const DEPLOYMENTS_LIST_MIN_LIMIT = 1;
export const DEPLOYMENTS_LIST_MAX_LIMIT = 50;
export const DEPLOYMENTS_LIST_DEFAULT_LIMIT = 20;

export interface DeploymentsListOptions {
  projectId?: string;
  limit?: number;
  /** Exclusive `created_at` cursor (ISO 8601). */
  before?: string;
  json?: boolean;
}

/** Validate `--limit`; throws with the flag name when it is out of range. */
export function parseLimitFlag(raw: number | undefined): number {
  if (raw === undefined) {
    return DEPLOYMENTS_LIST_DEFAULT_LIMIT;
  }
  if (
    !Number.isInteger(raw) ||
    raw < DEPLOYMENTS_LIST_MIN_LIMIT ||
    raw > DEPLOYMENTS_LIST_MAX_LIMIT
  ) {
    throw new Error(
      `--limit must be a whole number from ${DEPLOYMENTS_LIST_MIN_LIMIT} to ${DEPLOYMENTS_LIST_MAX_LIMIT} (got "${raw}")`,
    );
  }
  return raw;
}

export async function runDeploymentsList(
  options: DeploymentsListOptions = {},
): Promise<void> {
  const limit = parseLimitFlag(options.limit);
  const before =
    options.before != null
      ? parseIsoFlag("--before", options.before)
      : undefined;
  const projectId = options.projectId?.trim() || (await requireProjectId());

  logStep(`Listing last ${limit} deployments`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectDeployments(projectId, {
    limit,
    ...(before ? { before } : {}),
  });
  logVerbose(`found ${result.deployments.length} deployment(s)`);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const line of formatDeploymentList(
    result.deployments,
    result.next_before,
  )) {
    console.log(line);
  }
}
