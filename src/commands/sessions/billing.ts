import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface SessionsBillingOptions {
  sessionId: string;
  projectId?: string;
  json?: boolean;
}

export async function runSessionsBilling(
  options: SessionsBillingOptions,
): Promise<void> {
  const sessionId = options.sessionId.trim();
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Fetching billing for session ${sessionId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const session = await api.getProjectSession(projectId, sessionId);
  logVerbose(
    `status=${session.status} billable_seconds=${session.billable_seconds ?? "null"}`,
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          project_id: projectId,
          orchestrator_session_id: session.orchestrator_session_id,
          status: session.status,
          billable_seconds: session.billable_seconds,
          end_reason: session.end_reason,
          billing_started_at: session.billing_started_at,
          ended_at: session.ended_at,
          created_at: session.created_at,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`orchestrator_session_id=${session.orchestrator_session_id}`);
  console.log(`status=${session.status}`);
  console.log(
    `billable_seconds=${session.billable_seconds != null ? session.billable_seconds : "-"}`,
  );
  console.log(`end_reason=${session.end_reason ?? "-"}`);
  console.log(`billing_started_at=${session.billing_started_at ?? "-"}`);
  console.log(`ended_at=${session.ended_at ?? "-"}`);
  console.log(`created_at=${session.created_at}`);
}
