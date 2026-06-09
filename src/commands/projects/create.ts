import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";

export interface ProjectsCreateOptions {
  name: string;
  slug?: string;
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
    throw new Error("--name is required");
  }

  const slug = (options.slug?.trim() || slugifyName(name)).replace(
    /^-+|-+$/g,
    "",
  );
  if (!slug) {
    throw new Error("Could not derive a valid slug; pass --slug explicitly");
  }

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const project = await api.createProject(name, slug);

  console.log(JSON.stringify(project, null, 2));
}
