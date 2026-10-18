import {
  createApi,
  type DeploymentFailure,
  type DeploymentJob,
} from "../lib/api.js";
import { logStep, logVerbose } from "../lib/command-log.js";
import { requireCredentials } from "../lib/config.js";
import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import { pollWithBackoff } from "../lib/poll-backoff.js";
import { resolveProjectId } from "../lib/project-config.js";

export type DeployMode = "drain" | "force";

export function parseDeployMode(raw: string | undefined): DeployMode {
  const value = raw?.trim() ?? "";
  if (value === "" || value === "drain") return "drain";
  if (value === "force") return "force";
  throw new Error(`Invalid --mode "${raw}". Use drain or force.`);
}

export interface DeployOptions {
  projectId?: string;
  buildId?: string;
  mode?: DeployMode;
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

/**
 * Thrown after the failure has been printed in full. The top-level handler
 * only sets the exit code and prints nothing more.
 */
export class DeployFailureReported extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeployFailureReported";
  }
}

function retryLine(failure: DeploymentFailure): string {
  const attempt =
    failure.attempt !== null && failure.max_attempts !== null
      ? ` (attempt ${failure.attempt} of ${failure.max_attempts})`
      : "";
  return `Retrying automatically${attempt}: ${failure.message}`;
}

function failedAtText(completedAt: string | null): string {
  if (!completedAt) return "unknown";
  const time = Date.parse(completedAt);
  return Number.isNaN(time) ? completedAt : new Date(time).toISOString();
}

/** The lines printed to stderr for a failed deploy that carries a `failure`, or null when the class has no special output. */
export function formatDeployFailure(job: DeploymentJob): string[] | null {
  const failure = job.failure;
  if (!failure) return null;
  if (failure.class === "customer") {
    return [
      `Deploy failed: ${failure.message}`,
      `Fix your agent and deploy again. Agent logs: voicethere projects logs list --project ${job.project_id}`,
    ];
  }
  if (failure.class === "platform") {
    return [
      `Deploy failed: ${failure.message}`,
      failure.support_email
        ? `This one is on our side. Email ${failure.support_email} with these details:`
        : "This one is on our side. Contact support with these details:",
      `  Deployment: ${job.id}`,
      `  Project: ${job.project_id}`,
      `  Build: ${job.build_id || "none"}`,
      `  Code: ${failure.code}`,
      `  Trace id: ${job.trace_id || "none"}`,
      `  Failed at (UTC): ${failedAtText(job.completed_at)}`,
    ];
  }
  return null;
}

async function pollDeployment(
  api: ReturnType<typeof createApi>,
  jobId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<DeploymentJob> {
  const announcedAttempts = new Set<string>();
  return pollWithBackoff({
    poll: () => api.getDeployment(jobId),
    isTerminal: (job) => TERMINAL_STATUSES.has(job.status),
    getProgress: (job) => ({
      status: job.status,
      progressId: job.build_id,
    }),
    getRetryAfterMs: (job) => job.retry_after_ms,
    getLastDetail: (job) => job.error,
    onPoll: (job) => {
      logVerbose(`deployment ${jobId}: status=${job.status}`);
      const failure = job.failure;
      if (failure?.class === "transient") {
        const key = String(failure.attempt);
        if (!announcedAttempts.has(key)) {
          announcedAttempts.add(key);
          console.error(retryLine(failure));
        }
      }
    },
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for deployment ${jobId}`,
  });
}

/**
 * Promote (if needed) and enqueue a deploy job; optionally poll until done.
 */
export async function runDeploy(options: DeployOptions = {}): Promise<void> {
  logStep("Starting cloud deployment");
  const project =
    options.projectId !== undefined
      ? { projectId: options.projectId.trim() }
      : await resolveProjectId();

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);

  logStep("Calling POST /deployments");
  const created = await api.createDeployment({
    project_id: project.projectId,
    build_id: options.buildId,
    mode: options.mode ?? "drain",
  });

  console.log(`Deployment queued: ${created.id}`);
  console.log(`  build: ${created.build_id}`);
  console.log(`  mode: ${created.mode}`);
  console.log(`  status: ${created.status}`);

  if (!options.wait) {
    console.log(
      `Poll with: voicethere deploy --wait --project ${project.projectId}`,
    );
    return;
  }

  logStep("Waiting for rollout to complete");
  const final = await pollDeployment(api, created.id, {
    pollIntervalMs: options.pollIntervalMs ?? 3_000,
    timeoutMs: options.timeoutMs ?? 600_000,
  });

  if (final.status === "failed") {
    const lines = formatDeployFailure(final);
    if (lines) {
      for (const line of lines) {
        console.error(line);
      }
      throw new DeployFailureReported(lines[0] ?? "Deployment failed");
    }
    throw new Error(final.error ?? "Deployment failed");
  }

  console.log(`Deployment completed: ${final.id}`);
  console.log(`  build: ${final.build_id}`);
  console.log(`  status: ${final.status}`);
  if (final.mode) {
    console.log(`  mode: ${final.mode}`);
  }
}

/** @deprecated use runDeploy */
export async function runDeployReserved(): Promise<void> {
  await runDeploy();
}
