import { createApi } from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsErrorsListOptions {
  projectId?: string;
  limit?: number;
  sessionId?: string;
  json?: boolean;
}

export async function runProjectsErrorsList(
  options: ProjectsErrorsListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const limit = options.limit ?? 20;

  logStep(
    options.sessionId
      ? `Listing errors for session ${options.sessionId}`
      : `Listing last ${limit} project session errors`,
  );

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  if (options.sessionId) {
    const result = await api.listSessionErrors(projectId, options.sessionId);
    logVerbose(`found ${result.errors.length} error(s)`);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    for (const row of result.errors) {
      console.log(
        `${row.created_at}\t${row.code}\t${row.source}\t${row.message}`,
      );
    }
    return;
  }

  const result = await api.listProjectSessionErrors(projectId, limit);
  logVerbose(`found ${result.errors.length} error(s)`);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const row of result.errors) {
    const session = row.orchestrator_session_id.slice(0, 12);
    console.log(
      `${row.created_at}\t${session}…\t${row.code}\t${row.source}\t${row.message}`,
    );
  }
}
