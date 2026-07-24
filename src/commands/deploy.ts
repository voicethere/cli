import { createApi, type DeploymentJob } from "../lib/api.js";
import { logStep, logVerbose } from "../lib/command-log.js";
import { requireCredentials } from "../lib/config.js";
import { pollWithBackoff } from "../lib/poll-backoff.js";
import { resolveProjectId } from "../lib/project-config.js";

export interface DeployOptions {
  projectId?: string;
  buildId?: string;
  mode?: "drain" | "force";
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

async function pollDeployment(
  api: ReturnType<typeof createApi>,
  jobId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<DeploymentJob> {
  return pollWithBackoff({
    poll: () => api.getDeployment(jobId),
    isTerminal: (job) => TERMINAL_STATUSES.has(job.status),
    getProgress: (job) => ({
      status: job.status,
      progressId: job.build_id,
    }),
    getRetryAfterMs: (job) => job.retry_after_ms,
    onPoll: (job) => logVerbose(`deployment ${jobId}: status=${job.status}`),
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
  const api = createApi(credentials.api_key, credentials.api_base);

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
    throw new Error(final.error ?? "Deployment failed");
  }

  console.log(`Deployment completed: ${final.id}`);
  console.log(`  build: ${final.build_id}`);
  console.log(`  status: ${final.status}`);
}

/** @deprecated use runDeploy */
export async function runDeployReserved(): Promise<void> {
  await runDeploy();
}
