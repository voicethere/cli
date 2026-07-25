import { stat } from "node:fs/promises";

import {
  logResolvedBundle,
  logResolvedProject,
  logStep,
  logVerbose,
} from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import {
  assertBundleExists,
  resolveBundlePathDetailed,
  resolveProjectId,
} from "../../lib/project-config.js";
import { runBuildValidate, type BuildValidateOptions } from "./validate.js";

export interface BuildUploadOptions extends BuildValidateOptions {
  message?: string;
  skipValidate?: boolean;
}

export async function runBuildUpload(
  options: BuildUploadOptions,
): Promise<void> {
  logStep("Uploading agent bundle");
  const project = await resolveProjectId();
  const bundle = await resolveBundlePathDetailed(options.file);
  logResolvedProject(project);
  logResolvedBundle(bundle);

  if (!options.skipValidate) {
    logStep("Validating bundle locally before upload");
    await runBuildValidate({ file: options.file, logContext: false });
  } else {
    logVerbose("skipping local validation (--skip-validate)");
    await assertBundleExists(bundle.absolutePath);
  }

  const bundleStat = await stat(bundle.absolutePath);
  logVerbose(`bundle size: ${bundleStat.size} bytes`);

  logStep("Uploading bundle to control plane API");
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const build = await api.uploadBuild(
    project.projectId,
    bundle.absolutePath,
    options.message,
  );

  console.log(`Uploaded build ${build.id}`);
  if (build.message) {
    console.log(`Message: ${build.message}`);
  }
  console.log(`Uploaded at: ${build.created_at}`);
  console.log("");
  console.log("Upload stored in history. Promote when ready:");
  console.log(`  voicethere build promote ${build.id}`);
}
