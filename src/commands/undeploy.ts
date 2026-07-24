import { createApi, type DeploymentJob } from "../lib/api.js";
import { logStep, logVerbose } from "../lib/command-log.js";
import { requireCredentials } from "../lib/config.js";
import { pollWithBackoff } from "../lib/poll-backoff.js";
import { resolveProjectId } from "../lib/project-config.js";

export interface UndeployOptions {
  projectId?: string;
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
    onPoll: (job) => logVerbose(`undeploy ${jobId}: status=${job.status}`),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for undeploy ${jobId}`,
  });
}

/**
 * Remove the project's cloud deployment.
 */
export async function runUndeploy(
  options: UndeployOptions = {},
): Promise<void> {
  logStep("Starting project undeploy");
  const project =
    options.projectId !== undefined
      ? { projectId: options.projectId.trim() }
      : await resolveProjectId();

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  logStep(`Calling POST /projects/${project.projectId}/undeploy`);
  const created = await api.undeployProject(project.projectId);

  console.log(`Undeploy queued: ${created.id}`);
  console.log(`  build: ${created.build_id}`);
  console.log(`  status: ${created.status}`);

  if (!options.wait) {
    console.log(
      `Poll with: voicethere undeploy --wait --project ${project.projectId}`,
    );
    return;
  }

  logStep("Waiting for undeploy to complete");
  const final = await pollDeployment(api, created.id, {
    pollIntervalMs: options.pollIntervalMs ?? 3_000,
    timeoutMs: options.timeoutMs ?? 600_000,
  });

  if (final.status === "failed") {
    throw new Error(final.error ?? "Undeploy failed");
  }

  console.log(`Undeploy completed: ${final.id}`);
  console.log(`  status: ${final.status}`);
}
