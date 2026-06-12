import { writeProjectConfig } from "../../lib/project-config.js";

export interface ProjectsUseOptions {
  project: string;
  slug?: string;
  name?: string;
  bundle?: string;
}

export async function runProjectsUse(
  options: ProjectsUseOptions,
): Promise<void> {
  const projectId = options.project.trim();
  if (!projectId) {
    throw new Error("--project is required");
  }

  const path = await writeProjectConfig({
    project_id: projectId,
    project_slug: options.slug?.trim() || undefined,
    name: options.name?.trim() || undefined,
    bundle: options.bundle?.trim() || undefined,
  });

  console.log(`Linked ${path} → project_id=${projectId}`);
}
