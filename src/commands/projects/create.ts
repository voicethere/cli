import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";
import { logCommandInfo, logStep, logVerbose } from "../../lib/command-log.js";
import { writeProjectConfig } from "../../lib/project-config.js";

export interface ProjectsCreateOptions {
  name: string;
  slug?: string;
  /** Write `.voicethere/config.json` with the new project id (default true). */
  link?: boolean;
  bundle?: string;
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function runProjectsCreate(
  options: ProjectsCreateOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("project name is required");
  }

  const slug = (options.slug?.trim() || slugifyName(name)).replace(
    /^-+|-+$/g,
    "",
  );
  if (!slug) {
    throw new Error("Could not derive a valid slug; pass --slug explicitly");
  }

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);

  logStep(`Creating project "${name}" (slug=${slug})`);
  const project = await api.createProject(name, slug);
  logVerbose(`project id: ${project.id}`);

  const shouldLink = options.link !== false;
  if (shouldLink) {
    logStep("Writing .voicethere/config.json");
    const configPath = await writeProjectConfig({
      project_id: project.id,
      project_slug: project.slug,
      name: project.name,
      bundle: options.bundle?.trim() || undefined,
    });
    logCommandInfo(`project config: ${configPath}`);
    console.error(
      `Using project ${project.name} (${project.id}) — commit ${configPath}`,
    );
  }

  console.log(JSON.stringify(project, null, 2));
}
