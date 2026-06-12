import { createApi } from "../../lib/api.js";
import { logResolvedProject } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { resolveProjectId } from "../../lib/project-config.js";

export interface BuildListOptions {
  /** Reserved for tests. */
  startDir?: string;
}

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

export async function runBuildList(options: BuildListOptions = {}): Promise<void> {
  const project = await resolveProjectId({ startDir: options.startDir });
  logResolvedProject(project);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  const [platformProject, builds] = await Promise.all([
    api.getProject(project.projectId),
    api.listBuilds(project.projectId),
  ]);

  if (builds.length === 0) {
    console.log("No builds uploaded yet.");
    return;
  }

  console.log("build_id\tuploaded_at\tstatus\tactive\tmessage");

  for (const build of builds) {
    const active =
      platformProject.active_build_id === build.id ? "yes" : "";
    const message = build.message?.replace(/\s+/g, " ").trim() ?? "";
    console.log(
      `${build.id}\t${formatUploadedAt(build.created_at)}\t${build.validation_status}\t${active}\t${message}`,
    );
  }
}
