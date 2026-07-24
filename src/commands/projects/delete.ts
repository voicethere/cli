import { unlink } from "node:fs/promises";

import { createApi, type ProjectDeletionJob } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { logCommandInfo, logStep, logVerbose } from "../../lib/command-log.js";
import { pollWithBackoff } from "../../lib/poll-backoff.js";
import { isInteractive, promptConfirmText } from "../../lib/prompt.js";
import {
  readProjectConfig,
  requireProjectId,
} from "../../lib/project-config.js";

export interface ProjectsDeleteOptions {
  projectId?: string;
  force?: boolean;
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

async function pollProjectDeletion(
  api: ReturnType<typeof createApi>,
  projectId: string,
  jobId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<ProjectDeletionJob> {
  return pollWithBackoff({
    poll: () => api.getProjectDeletionJob(projectId, jobId),
    isTerminal: (job) => TERMINAL_STATUSES.has(job.status),
    getProgress: (job) => ({
      status: job.status,
      progressId: job.step,
    }),
    getRetryAfterMs: (job) => job.retry_after_ms,
    onPoll: (job) =>
      logVerbose(
        `project deletion ${jobId}: status=${job.status} step=${job.step}`,
      ),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for project deletion ${jobId}`,
  });
}

export async function runProjectsDelete(
  options: ProjectsDeleteOptions,
): Promise<void> {
  logStep("Deleting project");
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logVerbose(`project id: ${projectId}`);

  logStep("Fetching project details");
  const project = await api.getProject(projectId);

  if (!options.force) {
    if (isInteractive()) {
      logStep(`Confirm deletion by typing "${project.name}"`);
      await promptConfirmText(
        `Type "${project.name}" to confirm deletion: `,
        project.name,
      );
    } else {
      throw new Error(
        `Refusing to delete "${project.name}" without confirmation. Re-run in a TTY or pass --force.`,
      );
    }
  } else {
    logVerbose("skipping name confirmation (--force)");
  }

  logStep(`Removing project "${project.name}" and all builds from the API`);
  const result = await api.deleteProject(projectId, {
    force: options.force,
    confirmName: options.force ? undefined : project.name,
  });

  if (result.mode === "queued") {
    console.log(`Project deletion queued: ${result.jobId}`);
    console.log(`  project: ${projectId}`);
    console.log(`  status: queued`);

    if (!options.wait) {
      console.log(
        `Poll with: voicethere projects delete --wait --force ${projectId}`,
      );
    } else {
      logStep("Waiting for project deletion to complete");
      const final = await pollProjectDeletion(api, projectId, result.jobId, {
        pollIntervalMs: options.pollIntervalMs ?? 3_000,
        timeoutMs: options.timeoutMs ?? 600_000,
      });

      if (final.status === "failed") {
        throw new Error(final.error ?? "Project deletion failed");
      }

      console.log(`Project deletion completed: ${final.id}`);
      console.log(`  status: ${final.status}`);
      console.log(`  step: ${final.step}`);
    }
  }

  const linked = await readProjectConfig();
  if (linked?.config.project_id === projectId) {
    await unlink(linked.path);
    logCommandInfo(`removed project config: ${linked.path}`);
  }

  if (result.mode === "completed" || options.wait) {
    logStep(`Deleted project ${project.name} (${projectId})`);
  } else {
    logStep(
      `Project deletion queued for ${project.name} (${projectId}); use --wait to block until finished`,
    );
  }
}
