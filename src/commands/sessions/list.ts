import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface SessionsListOptions {
  projectId?: string;
  start?: number;
  end?: number;
}

export async function runSessionsList(
  options: SessionsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const start = options.start ?? 0;
  const end = options.end;

  logStep(`Listing sessions for project ${projectId}`);
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const page = await api.listProjectSessions(projectId, { start, end });
  logVerbose(
    `page ${page.start}-${page.end} of ${page.count} (${page.sessions.length} row(s))`,
  );

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
