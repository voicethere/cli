import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";

export async function runProjectsList(): Promise<void> {
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const projects = await api.listProjects();

  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  for (const project of projects) {
    const active = project.active_build_id ?? "none";
    console.log(
      `${project.id}\t${project.slug}\t${project.name}\tactive_build=${active}`,
    );
  }
}
