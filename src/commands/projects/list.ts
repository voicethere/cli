import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";

export async function runProjectsList(): Promise<void> {
  logStep("Listing projects");
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projects = await api.listProjects();
  logVerbose(`found ${projects.length} project(s)`);

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
