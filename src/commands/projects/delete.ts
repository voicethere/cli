import { unlink } from "node:fs/promises";

import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { logCommandInfo, logStep, logVerbose } from "../../lib/command-log.js";
import {
  isInteractive,
  promptConfirmText,
} from "../../lib/prompt.js";
import {
  readProjectConfig,
  requireProjectId,
} from "../../lib/project-config.js";

export interface ProjectsDeleteOptions {
  projectId?: string;
  force?: boolean;
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
  await api.deleteProject(projectId, {
    force: options.force,
    confirmName: options.force ? undefined : project.name,
  });

  const linked = await readProjectConfig();
  if (linked?.config.project_id === projectId) {
    await unlink(linked.path);
    logCommandInfo(`removed project config: ${linked.path}`);
  }

  logStep(`Deleted project ${project.name} (${projectId})`);
}
