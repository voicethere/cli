import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

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

export interface AgentVerifySpawnArgs {
  cmd: string;
  args: string[];
}

/** Resolve the installed @voicethere/agent CLI entry (dist/cli.js). */
export function resolveAgentCliJs(): string {
  const require = createRequire(import.meta.url);
  const agentEntry = require.resolve("@voicethere/agent");
  const packageDir = dirname(dirname(agentEntry));
  const pkg = JSON.parse(
    readFileSync(join(packageDir, "package.json"), "utf8"),
  ) as { bin?: string | Record<string, string> };
  const binField = pkg.bin;
  const binRel =
    typeof binField === "string"
      ? binField
      : (binField?.["@voicethere/agent"] ?? binField?.agent);
  if (!binRel) {
    throw new Error("@voicethere/agent package.json is missing a bin field");
  }
  return join(packageDir, binRel);
}

export function agentVerifySpawnArgs(bundlePath: string): AgentVerifySpawnArgs {
  return {
    cmd: process.execPath,
    args: [resolveAgentCliJs(), "verify", "--no-build", "--bundle", bundlePath],
  };
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
  const { cmd, args } = agentVerifySpawnArgs(bundlePath);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

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
