import { logStep } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import type { UsagePeriod, UsageQuery } from "../../../lib/api.js";

export interface ProjectsUsageShowOptions {
  projectId?: string;
  org?: boolean;
  period?: UsagePeriod;
  from?: string;
  to?: string;
  bucket?: "hour" | "day";
}

export async function runProjectsUsageShow(
  options: ProjectsUsageShowOptions = {},
): Promise<void> {
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const query: UsageQuery = {
    period: options.period,
    from: options.from,
    to: options.to,
    bucket: options.bucket,
  };

  if (options.org) {
    logStep("Reading organization usage rollup");
    const usage = await api.getOrgUsage(query);
    console.log(JSON.stringify(usage, null, 2));
    return;
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading usage for project ${projectId}`);
  const usage = await api.getProjectUsage(projectId, query);
  console.log(JSON.stringify(usage, null, 2));
}
