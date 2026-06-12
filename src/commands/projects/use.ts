import { createApi, type Project } from "../../lib/api.js";
import { logCommandInfo } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { isInteractive, promptChoice } from "../../lib/prompt.js";
import {
  readProjectConfig,
  writeProjectConfig,
} from "../../lib/project-config.js";

export interface ProjectsUseOptions {
  projectId?: string;
  slug?: string;
  name?: string;
  bundle?: string;
  startDir?: string;
}

function formatProjectChoice(project: Project): string {
  const active = project.active_build_id
    ? `active=${project.active_build_id.slice(0, 8)}…`
    : "no active build";
  return `${project.name} (${project.slug}) — ${project.id} — ${active}`;
}

async function resolveProjectToUse(
  api: ReturnType<typeof createApi>,
  options: ProjectsUseOptions,
): Promise<{ project: Project; fromExistingConfig: boolean; configPath?: string }> {
  const trimmed = options.projectId?.trim();
  if (trimmed) {
    return { project: await api.getProject(trimmed), fromExistingConfig: false };
  }

  const linked = await readProjectConfig(options.startDir);
  if (linked?.config.project_id) {
    logCommandInfo(`using project from ${linked.path}`);
    return {
      project: await api.getProject(linked.config.project_id),
      fromExistingConfig: true,
      configPath: linked.path,
    };
  }

  if (!isInteractive()) {
    throw new Error(
      "No .voicethere/config.json found. Run: voicethere projects use <projectId>",
    );
  }

  const projects = await api.listProjects();
  if (projects.length === 0) {
    throw new Error(
      "No projects found. Create one with: voicethere projects create \"My Agent\"",
    );
  }

  const selectedId = await promptChoice(
    "Choose a project",
    projects.map((project) => ({
      label: formatProjectChoice(project),
      value: project.id,
    })),
  );

  const selected = projects.find((project) => project.id === selectedId);
  if (!selected) {
    throw new Error("Selected project not found.");
  }
  return { project: selected, fromExistingConfig: false };
}

export async function runProjectsUse(
  options: ProjectsUseOptions,
): Promise<void> {
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const linked = await readProjectConfig(options.startDir);
  const { project, fromExistingConfig, configPath } =
    await resolveProjectToUse(api, options);

  const bundle =
    options.bundle?.trim() || linked?.config.bundle?.trim() || undefined;

  logCommandInfo(`project: ${project.id} (${project.name})`);

  const path = await writeProjectConfig(
    {
      project_id: project.id,
      project_slug: options.slug?.trim() || project.slug,
      name: options.name?.trim() || project.name,
      bundle,
    },
    {
      startDir: options.startDir,
      path: fromExistingConfig ? configPath : undefined,
    },
  );

  if (bundle) {
    logCommandInfo(`default bundle: ${bundle}`);
  }
  logCommandInfo(`project config: ${path}`);

  if (fromExistingConfig) {
    console.log(
      `Using project ${project.name} (${project.id}) from ${path}`,
    );
    return;
  }

  console.log(`Using project ${project.name} (${project.id})`);
  console.log(`Saved ${path}`);
}
