import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApi } from "../../lib/api.js";
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
  const api = createApi(credentials.api_key, credentials.api_base);
  const sessions = await api.listProjectSessions(projectId, { start, end });
  logVerbose(`found ${sessions.length} session(s)`);

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  for (const session of sessions) {
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
}
