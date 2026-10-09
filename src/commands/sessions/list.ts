import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId } from "../../lib/project-config.js";
import { parseIsoFlag } from "../projects/metrics/range.js";
import type { ProjectSessionListFilter } from "../../lib/api.js";

export interface SessionsListOptions {
  projectId?: string;
  start?: number;
  end?: number;
  /** Only failed sessions. */
  failed?: boolean;
  /** Failure reason key; implies `failed`. */
  reason?: string;
  /** ISO 8601 lower bound. */
  from?: string;
  /** ISO 8601 upper bound. */
  to?: string;
  /** Print the raw page JSON. */
  json?: boolean;
}

const REASON_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

function buildFilter(options: SessionsListOptions): ProjectSessionListFilter {
  const filter: ProjectSessionListFilter = {};
  if (options.reason != null) {
    if (!REASON_PATTERN.test(options.reason)) {
      throw new Error(
        `--reason must match ${REASON_PATTERN.source} (got "${options.reason}")`,
      );
    }
    filter.reason = options.reason;
  }
  if (options.failed || options.reason != null) {
    filter.outcome = "failed";
  }
  if (options.from != null) {
    filter.from = parseIsoFlag("--from", options.from);
  }
  if (options.to != null) {
    filter.to = parseIsoFlag("--to", options.to);
  }
  return filter;
}

export async function runSessionsList(
  options: SessionsListOptions = {},
): Promise<void> {
  const filter = buildFilter(options);
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const start = options.start ?? 0;
  const end = options.end;

  logStep(`Listing sessions for project ${projectId}`);
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const page = await api.listProjectSessions(projectId, {
    start,
    end,
    ...filter,
  });
  logVerbose(
    `page ${page.start}-${page.end} of ${page.count} (${page.sessions.length} row(s))`,
  );

  if (options.json) {
    console.log(JSON.stringify(page, null, 2));
    return;
  }

  if (page.sessions.length === 0) {
    console.log(`No sessions found (${page.count} total).`);
    return;
  }

  for (const session of page.sessions) {
    const billable =
      session.billable_seconds != null ? String(session.billable_seconds) : "-";
    console.log(
      [
        session.orchestrator_session_id,
        session.status,
        `billable=${billable}`,
        session.end_reason ? `reason=${session.end_reason}` : null,
        `created=${session.created_at}`,
      ]
        .filter(Boolean)
        .join("\t"),
    );
  }

  console.log(
    `\nShowing ${page.start + 1}-${page.end} of ${page.count} sessions`,
  );
}
