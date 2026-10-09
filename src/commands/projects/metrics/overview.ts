import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  describeWindow,
  formatNumber,
  resolveMetricsRange,
  type MetricsRangeOptions,
} from "./range.js";

export interface ProjectsMetricsOverviewOptions extends MetricsRangeOptions {
  projectId?: string;
  json?: boolean;
}

export async function runProjectsMetricsOverview(
  options: ProjectsMetricsOverviewOptions = {},
): Promise<void> {
  const range = resolveMetricsRange(options);
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading metrics for project ${projectId}`);
  const api = createApiFromCredentials(await requireCredentials());
  const metrics = await api.getProjectMetrics(projectId, range);

  if (options.json) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log(`Project metrics (${describeWindow(metrics)})`);
  console.log(`  active sessions:     ${metrics.active_sessions}`);
  console.log(`  sessions started:    ${metrics.sessions_started}`);
  console.log(`  sessions ended:      ${metrics.sessions_ended}`);
  console.log(`  sessions failed:     ${metrics.sessions_failed}`);
  console.log(
    `  error rate:          ${formatNumber(metrics.error_rate * 100)}%`,
  );
  console.log(`  billable seconds:    ${metrics.billable_seconds}`);
  console.log(`  sessions in queue:   ${metrics.sessions_in_queue}`);
  console.log(
    `  avg queue wait (s):  ${formatNumber(metrics.avg_queue_wait_seconds)}`,
  );
}
