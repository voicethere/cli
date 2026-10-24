import type { DeploymentMetricsResponse } from "../../lib/api.js";
import { logStep } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface DeploymentsMetricsOptions {
  projectId?: string;
  /** Window length such as 30m, 24h or 7d. Default 24h. */
  since?: string;
  json?: boolean;
  now?: () => number;
}

const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseSince(raw: string): number {
  const match = /^(\d+)([mhd])$/.exec(raw.trim());
  if (!match || Number(match[1]) < 1) {
    throw new Error(`--since must look like 30m, 24h or 7d (got "${raw}")`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as string]!;
}

export function formatDeploymentMetrics(
  result: DeploymentMetricsResponse,
): string[] {
  const lines = [`Deployment metrics (${result.from} to ${result.to})`];
  if (result.deployments.length === 0) {
    lines.push("  (no sessions in this window)");
    return lines;
  }
  const rows = result.deployments.map((d) => ({
    build: d.build_id ? d.build_id.slice(0, 8) : "unknown",
    message: d.build?.message ?? "-",
    sessions: String(d.sessions),
    failed: String(d.failed),
    rate: `${d.failure_rate}%`,
    top:
      d.top_failure_keys.length === 0
        ? "-"
        : d.top_failure_keys.map((k) => `${k.key} (${k.count})`).join(", "),
  }));
  const headers = {
    build: "BUILD",
    message: "MESSAGE",
    sessions: "SESSIONS",
    failed: "FAILED",
    rate: "FAILURE RATE",
    top: "TOP FAILURES",
  };
  const keys = Object.keys(headers) as Array<keyof typeof headers>;
  const widths = keys.map((k) =>
    Math.max(headers[k].length, ...rows.map((r) => r[k].length)),
  );
  const render = (r: Record<keyof typeof headers, string>) =>
    "  " +
    keys
      .map((k, i) => r[k].padEnd(widths[i]!))
      .join("  ")
      .trimEnd();
  lines.push(render(headers));
  for (const row of rows) lines.push(render(row));
  return lines;
}

export async function runDeploymentsMetrics(
  options: DeploymentsMetricsOptions = {},
): Promise<void> {
  const windowMs = parseSince(options.since ?? "24h");
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const to = (options.now ?? Date.now)();
  const from = new Date(to - windowMs).toISOString();
  logStep(`Reading deployment metrics for project ${projectId}`);
  const api = createApiFromCredentials(await requireCredentials());
  const result = await api.getDeploymentMetrics(projectId, {
    from,
    to: new Date(to).toISOString(),
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const line of formatDeploymentMetrics(result)) console.log(line);
}
