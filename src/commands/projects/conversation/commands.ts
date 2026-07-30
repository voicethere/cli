import {
  type ListProjectConversationsQuery,
  type ListProjectConversationsResponse,
  type SessionConversationResponse,
} from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ProjectsConversationListOptions {
  projectId?: string;
  limit?: number;
  q?: string;
  json?: boolean;
}

function buildQuery(
  options: ProjectsConversationListOptions,
): ListProjectConversationsQuery {
  const query: ListProjectConversationsQuery = {
    limit: options.limit ?? 50,
  };
  if (options.q?.trim()) {
    query.q = options.q.trim();
  }
  return query;
}

function printConversationList(result: ListProjectConversationsResponse): void {
  for (const row of result.conversations) {
    const started = row.startedAt ?? "—";
    const session = row.orchestratorSessionId.slice(0, 12);
    console.log(
      `${started}\t${session}…\t${row.turnCount} turn(s)\t${row.orchestratorSessionId}`,
    );
  }
  if (result.matches?.length) {
    console.log("");
    console.log("Matching turns:");
    for (const match of result.matches) {
      console.log(
        `${match.occurredAt}\t${match.orchestratorSessionId.slice(0, 12)}…\t#${match.turnIndex}\t${match.role}\t${match.text}`,
      );
    }
  }
}

export async function runProjectsConversationList(
  options: ProjectsConversationListOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const query = buildQuery(options);

  logStep(
    query.q
      ? `Searching conversation history for "${query.q}"`
      : `Listing last ${query.limit} project conversations`,
  );

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listProjectConversations(projectId, query);

  logVerbose(`found ${result.conversations.length} conversation(s)`);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printConversationList(result);
}

export interface ProjectsConversationGetOptions {
  projectId?: string;
  sessionId: string;
  json?: boolean;
}

export async function runProjectsConversationGet(
  options: ProjectsConversationGetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const sessionId = options.sessionId.trim();

  logStep(`Loading conversation for session ${sessionId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.getSessionConversation(projectId, sessionId);

  logVerbose(`found ${result.turns.length} turn(s)`);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printSessionConversation(result);
}

export interface ProjectsConversationSearchOptions {
  projectId?: string;
  query: string;
  limit?: number;
  json?: boolean;
}

export async function runProjectsConversationSearch(
  options: ProjectsConversationSearchOptions,
): Promise<void> {
  await runProjectsConversationList({
    projectId: options.projectId,
    limit: options.limit,
    q: options.query,
    json: options.json,
  });
}

function printSessionConversation(result: SessionConversationResponse): void {
  const conversation = result.conversation;
  console.log(
    `Session ${conversation.orchestratorSessionId} (${conversation.turnCount} turn(s))`,
  );
  for (const turn of result.turns) {
    console.log(
      `${turn.occurredAt}\t#${turn.turnIndex}\t${turn.role}\t${turn.eventType}\t${turn.text}`,
    );
  }
}
