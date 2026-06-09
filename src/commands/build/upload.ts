import { createApi } from "../../lib/api.js";
import { requireCredentials } from "../../lib/config.js";
import {
  DEFAULT_BUNDLE_PATH,
  runBuildValidate,
  type BuildValidateOptions,
} from "./validate.js";

export interface BuildUploadOptions extends BuildValidateOptions {
  project: string;
  skipValidate?: boolean;
}

export async function runBuildUpload(
  options: BuildUploadOptions,
): Promise<void> {
  const projectId = options.project.trim();
  if (!projectId) {
    throw new Error("--project is required");
  }

  const bundlePath = options.file?.trim() || DEFAULT_BUNDLE_PATH;

  if (!options.skipValidate) {
    await runBuildValidate({ file: bundlePath });
  }

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const build = await api.uploadBuild(projectId, bundlePath);

  console.log(JSON.stringify(build, null, 2));
}
