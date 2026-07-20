import {
  createApi,
  type AgentLogLevel,
  type ListAgentLogsQuery,
} from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsLogsListOptions {
  projectId?: string;
  limit?: number;
  sessionId?: string;
  q?: string;
  level?: AgentLogLevel;
  json?: boolean;
}

function buildQuery(options: ProjectsLogsListOptions): ListAgentLogsQuery {
  const query: ListAgentLogsQuery = { limit: options.limit ?? 20 };
  if (options.q?.trim()) {
    query.q = options.q.trim();
  }
  if (options.level) {
    query.level = options.level;
  }
  return query;
}

export async function runProjectsLogsList(
  options: ProjectsLogsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const query = buildQuery(options);

  logStep(
    options.sessionId
      ? `Listing logs for session ${options.sessionId}`
      : `Listing last ${query.limit} project agent logs`,
  );

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  if (options.sessionId) {
    const result = await api.listSessionLogs(
      projectId,
      options.sessionId,
      query,
    );
    logVerbose(`found ${result.logs.length} log(s)`);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    for (const row of result.logs) {
      console.log(`${row.created_at}\t${row.level}\t${row.message}`);
    }
    return;
  }

  const result = await api.listProjectLogs(projectId, query);
  logVerbose(`found ${result.logs.length} log(s)`);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const row of result.logs) {
    const session = row.orchestrator_session_id?.slice(0, 12) ?? "—";
    console.log(`${row.created_at}\t${session}…\t${row.level}\t${row.message}`);
  }
}
