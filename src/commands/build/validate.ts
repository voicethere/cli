import { spawn } from "node:child_process";

import {
  logResolvedBundle,
  logStep,
  logVerbose,
} from "../../lib/command-log.js";
import {
  assertBundleExists,
  resolveBundlePathDetailed,
} from "../../lib/project-config.js";

export const DEFAULT_BUNDLE_PATH = "dist/agent.js";

export interface BuildValidateOptions {
  file?: string;
  /** When false, skip startup path logging (caller already logged). Default true. */
  logContext?: boolean;
}

export async function runBuildValidate(
  options: BuildValidateOptions,
): Promise<void> {
  logStep("Validating agent bundle");
  const bundle = await resolveBundlePathDetailed(options.file);
  if (options.logContext !== false) {
    logResolvedBundle(bundle);
  }
  await assertBundleExists(bundle.absolutePath);
  logStep("Running @voicethere/agent verify on bundle");
  logVerbose(`verify bundle: ${bundle.absolutePath}`);
  await spawnAgentVerify(bundle.absolutePath);
  console.log(`Bundle validated: ${bundle.absolutePath}`);
}

async function spawnAgentVerify(bundlePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["@voicethere/agent", "verify", "--no-build", "--bundle", bundlePath],
      {
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`Agent verify failed with exit code ${code ?? "unknown"}`),
      );
    });
  });
}
