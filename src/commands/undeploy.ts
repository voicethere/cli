import { createApi, type DeploymentJob } from "../lib/api.js";
import { logStep, logVerbose } from "../lib/command-log.js";
import { requireCredentials } from "../lib/config.js";
import { resolveProjectId } from "../lib/project-config.js";

export interface UndeployOptions {
  projectId?: string;
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollDeployment(
  api: ReturnType<typeof createApi>,
  jobId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<DeploymentJob> {
  const started = Date.now();
  while (Date.now() - started < options.timeoutMs) {
    const job = await api.getDeployment(jobId);
    logVerbose(`undeploy ${jobId}: status=${job.status}`);
    if (TERMINAL_STATUSES.has(job.status)) {
      return job;
    }
    await sleep(options.pollIntervalMs);
  }
  throw new Error(
    `Timed out after ${options.timeoutMs}ms waiting for undeploy ${jobId}`,
  );
}

/**
 * Remove the project's runner deployment from the cluster.
 */
export async function runUndeploy(options: UndeployOptions = {}): Promise<void> {
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
