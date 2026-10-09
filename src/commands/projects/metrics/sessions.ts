import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  describeWindow,
  formatNumber,
  printTable,
  resolveMetricsRange,
  type MetricsRangeOptions,
} from "./range.js";

export interface ProjectsMetricsSessionsOptions extends MetricsRangeOptions {
  projectId?: string;
  json?: boolean;
}

export async function runProjectsMetricsSessions(
  options: ProjectsMetricsSessionsOptions = {},
): Promise<void> {
  const range = resolveMetricsRange(options);
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading session metrics for project ${projectId}`);
  const api = createApiFromCredentials(await requireCredentials());
  const metrics = await api.getProjectSessionMetrics(projectId, range);

  if (options.json) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  const started = metrics.series.reduce((sum, p) => sum + p.started, 0);
  const completed = metrics.series.reduce((sum, p) => sum + p.completed, 0);
  const failed = metrics.series.reduce((sum, p) => sum + p.failed, 0);
  const neverConnected = metrics.series.reduce(
    (sum, p) => sum + p.never_connected,
    0,
  );
  const peak = metrics.series.reduce(
    (max, p) => Math.max(max, p.peak_concurrent),
    0,
  );

  console.log(`Session metrics (${describeWindow(metrics)})`);
  console.log(`  started:             ${started}`);
  console.log(`  completed:           ${completed}`);
  console.log(`  failed:              ${failed}`);
  console.log(`  never connected:     ${neverConnected}`);
  console.log(
    `  peak concurrent:     ${peak} (plan limit ${formatNumber(metrics.plan_concurrency_limit)})`,
  );
  console.log(
    `  duration p50/p95 (s): ${formatNumber(metrics.duration_p50_s)} / ${formatNumber(metrics.duration_p95_s)}`,
  );
  console.log(
    `  connect p50/p95 (s):  ${formatNumber(metrics.connect_p50_s)} / ${formatNumber(metrics.connect_p95_s)}`,
  );

  printTable(
    "Failures by reason",
    ["reason", "count"],
    metrics.failures.map((f) => [f.code, f.count]),
  );
  printTable(
    "End reasons",
    ["reason", "count"],
    metrics.end_reasons.map((r) => [r.reason, r.count]),
  );
}
