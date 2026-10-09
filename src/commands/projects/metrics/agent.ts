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

export interface ProjectsMetricsAgentOptions extends MetricsRangeOptions {
  projectId?: string;
  json?: boolean;
}

const MAX_MESSAGE_CHARS = 100;

export function truncateMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_MESSAGE_CHARS
    ? `${oneLine.slice(0, MAX_MESSAGE_CHARS - 3)}...`
    : oneLine;
}

export async function runProjectsMetricsAgent(
  options: ProjectsMetricsAgentOptions = {},
): Promise<void> {
  const range = resolveMetricsRange(options);
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading agent metrics for project ${projectId}`);
  const api = createApiFromCredentials(await requireCredentials());
  const metrics = await api.getProjectAgentMetrics(projectId, range);

  if (options.json) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  const sum = (key: "warn" | "error" | "info" | "crashes") =>
    metrics.series.reduce((total, p) => total + p[key], 0);

  console.log(`Agent metrics (${describeWindow(metrics)})`);
  console.log(`  errors:              ${sum("error")}`);
  console.log(`  warnings:            ${sum("warn")}`);
  console.log(`  info:                ${sum("info")}`);
  console.log(`  crashes:             ${sum("crashes")}`);
  console.log(
    `  turns/conversation p50/p95: ${formatNumber(metrics.turns_per_conversation_p50)} / ${formatNumber(metrics.turns_per_conversation_p95)}`,
  );

  printTable(
    "Top errors",
    ["message", "count"],
    metrics.top_errors.map((e) => [truncateMessage(e.message), e.count]),
  );
}
