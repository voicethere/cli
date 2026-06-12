import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import { requireProjectId, resolveBundlePath } from "../../lib/project-config.js";
import { runBuildValidate, type BuildValidateOptions } from "./validate.js";

export interface BuildUploadOptions extends BuildValidateOptions {
  project?: string;
  message?: string;
  skipValidate?: boolean;
}

export async function runBuildUpload(
  options: BuildUploadOptions,
): Promise<void> {
  const projectId = await requireProjectId({ projectFlag: options.project });
  const bundlePath = await resolveBundlePath(options.file);

  if (!options.skipValidate) {
    await runBuildValidate({ file: bundlePath });
  }

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const build = await api.uploadBuild(projectId, bundlePath, options.message);

  console.log(`Uploaded build ${build.id}`);
  if (build.message) {
    console.log(`Message: ${build.message}`);
  }
  console.log(`Uploaded at: ${build.created_at}`);
  console.log("");
  console.log("Upload stored in history. Promote when ready:");
  console.log(`  voicethere build promote ${build.id}`);
}
