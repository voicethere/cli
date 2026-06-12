import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId } from "../../lib/project-config.js";

export interface BuildListOptions {
  project?: string;
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

export async function runBuildList(options: BuildListOptions): Promise<void> {
  const projectId = await requireProjectId({ projectFlag: options.project });
  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);

  const [project, builds] = await Promise.all([
    api.getProject(projectId),
    api.listBuilds(projectId),
  ]);

  if (builds.length === 0) {
    console.log("No builds uploaded yet.");
    return;
  }

  console.log("build_id\tuploaded_at\tstatus\tactive\tmessage");

  for (const build of builds) {
    const active = project.active_build_id === build.id ? "yes" : "";
    const message = build.message?.replace(/\s+/g, " ").trim() ?? "";
    console.log(
      `${build.id}\t${formatUploadedAt(build.created_at)}\t${build.validation_status}\t${active}\t${message}`,
    );
  }
}
