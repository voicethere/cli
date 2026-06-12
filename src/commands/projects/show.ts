import { findProjectConfigPath, readProjectConfig } from "../../lib/project-config.js";

export async function runProjectsShow(): Promise<void> {
  const path = await findProjectConfigPath();
  if (!path) {
    console.log("No .voicethere/config.json found in this directory or parents.");
    console.log("Run: voicethere projects use <projectId>");
    return;
  }

  const linked = await readProjectConfig();
  if (!linked) {
    throw new Error(`Failed to read ${path}`);
  }

  console.log(
    JSON.stringify(
      {
        path: linked.path,
        ...linked.config,
      },
      null,
      2,
    ),
  );
}
