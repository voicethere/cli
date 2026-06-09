import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { constants } from "node:fs";

export const DEFAULT_BUNDLE_PATH = "dist/agent.js";

export interface BuildValidateOptions {
  file?: string;
}

export async function runBuildValidate(
  options: BuildValidateOptions,
): Promise<void> {
  const bundlePath = options.file?.trim() || DEFAULT_BUNDLE_PATH;
  await assertBundleExists(bundlePath);
  await spawnAgentVerify(bundlePath);
  console.log(`Bundle validated: ${bundlePath}`);
}

async function assertBundleExists(bundlePath: string): Promise<void> {
  try {
    await access(bundlePath, constants.R_OK);
  } catch {
    throw new Error(
      `Bundle not found or not readable: ${bundlePath} — run: npx @voicethere/agent build`,
    );
  }
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
