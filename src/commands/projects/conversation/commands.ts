import { writeFile } from "node:fs/promises";

import {
  type ConversationExportJobResponse,
  type ConversationTimeWindowQuery,
  type CreateConversationExportBody,
  type ListProjectConversationsQuery,
  type ListProjectConversationsResponse,
  type SessionConversationResponse,
  type UsagePeriod,
  createApi,
} from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { pollWithBackoff } from "../../../lib/poll-backoff.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface ConversationTimeWindowOptions extends ConversationTimeWindowQuery {
  cursor?: string;
}

export interface ProjectsConversationListOptions
  extends ConversationTimeWindowOptions {
  projectId?: string;
  limit?: number;
  q?: string;
  json?: boolean;
}

function applyTimeWindowFields(
  target: ConversationTimeWindowQuery,
  options: ConversationTimeWindowOptions,
): void {
  if (options.period) {
    target.period = options.period;
  }
  if (options.from?.trim()) {
    target.from = options.from.trim();
  }
  if (options.to?.trim()) {
    target.to = options.to.trim();
  }
}

function buildQuery(
  options: ProjectsConversationListOptions,
): ListProjectConversationsQuery {
  const query: ListProjectConversationsQuery = {
    limit: options.limit ?? 50,
  };
  applyTimeWindowFields(query, options);
  if (options.q?.trim()) {
    query.q = options.q.trim();
  }
  if (options.cursor?.trim()) {
    query.cursor = options.cursor.trim();
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
  if (result.next_cursor) {
    console.log("");
    console.log(`More results available (cursor: ${result.next_cursor})`);
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

export interface ProjectsConversationSearchOptions
  extends ConversationTimeWindowOptions {
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
    period: options.period,
    from: options.from,
    to: options.to,
    cursor: options.cursor,
    json: options.json,
  });
}

export interface ProjectsConversationExportOptions
  extends ConversationTimeWindowOptions {
  projectId?: string;
  session?: string;
  q?: string;
  all?: boolean;
  wait?: boolean;
  output?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  json?: boolean;
}

const EXPORT_TERMINAL_STATUSES = new Set(["completed", "failed"]);

function buildExportBody(
  options: ProjectsConversationExportOptions,
): CreateConversationExportBody {
  const session = options.session?.trim();
  const q = options.q?.trim();

  if (session) {
    if (options.all || q) {
      throw new Error(
        "Use only one of --session, --q, or --all for conversation export",
      );
    }
    return { mode: "session", sessionId: session };
  }

  if (options.all && q) {
    throw new Error("--all cannot be combined with --q");
  }

  if (!options.all && !q) {
    throw new Error(
      "Specify --session <id>, --q <text>, or --all for conversation export",
    );
  }

  const body: Extract<CreateConversationExportBody, { mode: "filter" }> = {
    mode: "filter",
    ...(q ? { q } : {}),
  };
  applyTimeWindowFields(body, options);
  return body;
}

async function pollConversationExport(
  api: ReturnType<typeof createApi>,
  projectId: string,
  jobId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<ConversationExportJobResponse> {
  return pollWithBackoff({
    poll: () => api.getConversationExport(projectId, jobId),
    isTerminal: (job) => EXPORT_TERMINAL_STATUSES.has(job.status),
    getProgress: (job) => ({
      status: job.status,
      progressId: String(job.progress.conversations_done),
    }),
    onPoll: (job) =>
      logVerbose(
        `conversation export ${jobId}: status=${job.status} progress=${job.progress.conversations_done}/${job.progress.conversations_total}`,
      ),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for conversation export ${jobId}`,
  });
}

async function downloadExportArtifact(
  downloadUrl: string,
  outputPath: string,
): Promise<void> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download export artifact (${response.status} ${response.statusText})`,
    );
  }
  const body = await response.text();
  await writeFile(outputPath, body, "utf8");
}

export async function runProjectsConversationExport(
  options: ProjectsConversationExportOptions = {},
): Promise<void> {
  if (options.output?.trim() && !options.wait) {
    throw new Error("--output requires --wait (export must finish before download)");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  const body = buildExportBody(options);

  logStep("Creating conversation export job");
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const created = await api.createConversationExport(projectId, body);
  const jobId = created.job_id;

  console.log(`Conversation export queued: ${jobId}`);
  console.log(`  project: ${projectId}`);
  console.log(`  mode: ${body.mode}`);

  if (!options.wait) {
    console.log(
      `Poll with: voicethere projects conversation export --wait ${describeExportFlags(options)}`,
    );
    return;
  }

  logStep("Waiting for conversation export to complete");
  const final = await pollConversationExport(api, projectId, jobId, {
    pollIntervalMs: options.pollIntervalMs ?? 3_000,
    timeoutMs: options.timeoutMs ?? 600_000,
  });

  if (final.status === "failed") {
    throw new Error(final.error ?? "Conversation export failed");
  }

  console.log(`Conversation export completed: ${final.job_id}`);
  console.log(
    `  conversations: ${final.progress.conversations_done}/${final.progress.conversations_total}`,
  );
  if (final.expires_at) {
    console.log(`  download expires: ${final.expires_at}`);
  }

  const outputPath = options.output?.trim();
  if (outputPath) {
    if (!final.download_url) {
      throw new Error("Export completed but no download_url was returned");
    }
    logStep(`Writing export to ${outputPath}`);
    await downloadExportArtifact(final.download_url, outputPath);
    console.log(`Wrote export JSON to ${outputPath}`);
  } else if (options.json) {
    console.log(JSON.stringify(final, null, 2));
  } else if (final.download_url) {
    console.log(`  download_url: ${final.download_url}`);
  }
}

function describeExportFlags(
  options: ProjectsConversationExportOptions,
): string {
  const parts: string[] = [];
  if (options.session?.trim()) {
    parts.push(`--session ${options.session.trim()}`);
  } else if (options.all) {
    parts.push("--all");
  } else if (options.q?.trim()) {
    parts.push(`--q ${JSON.stringify(options.q.trim())}`);
  }
  appendTimeWindowFlags(parts, options);
  return parts.join(" ");
}

function appendTimeWindowFlags(
  parts: string[],
  options: ConversationTimeWindowOptions & { period?: UsagePeriod },
): void {
  if (options.period) {
    parts.push(`--period ${options.period}`);
  }
  if (options.from?.trim()) {
    parts.push(`--from ${options.from.trim()}`);
  }
  if (options.to?.trim()) {
    parts.push(`--to ${options.to.trim()}`);
  }
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
