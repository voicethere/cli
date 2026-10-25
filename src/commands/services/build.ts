import { spawn } from "node:child_process";
import { logStep } from "../../lib/command-log.js";
import { runProjectsServicesSet } from "../projects/services/commands.js";

export interface ServicesBuildOptions {
  name: string;
  file?: string;
  context?: string;
  push: string;
  platform?: string;
  projectId?: string;
}

interface RunResult {
  code: number;
  stdout: string;
}

const MISSING_DOCKER =
  "docker with buildx was not found. Install Docker (https://docs.docker.com/get-docker/) and make sure `docker buildx` works, then retry.";

function runDocker(args: string[], inherit: boolean): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    });
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new Error(MISSING_DOCKER)
          : new Error(`failed to run docker: ${error.message}`),
      );
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

/** `registry.example.com:5000/team/app:v1` -> `registry.example.com:5000/team/app`. */
export function repoOfReference(reference: string): string {
  const withoutDigest = reference.split("@")[0]!;
  const lastSlash = withoutDigest.lastIndexOf("/");
  const lastColon = withoutDigest.lastIndexOf(":");
  return lastColon > lastSlash
    ? withoutDigest.slice(0, lastColon)
    : withoutDigest;
}

export async function runServicesBuild(
  options: ServicesBuildOptions,
): Promise<void> {
  const name = options.name.trim();
  const push = options.push.trim();
  if (!name) throw new Error("service name is required");
  if (!push) throw new Error("--push <repo:tag> is required");
  const platform = options.platform?.trim() || "linux/amd64";
  const file = options.file?.trim() || "Dockerfile";
  const context = options.context?.trim() || ".";

  logStep(`Building and pushing ${push} (${platform})`);
  const build = await runDocker(
    [
      "buildx",
      "build",
      "--platform",
      platform,
      "-f",
      file,
      "-t",
      push,
      "--push",
      context,
    ],
    true,
  );
  if (build.code !== 0) {
    throw new Error(`docker buildx build failed (exit ${build.code})`);
  }

  logStep(`Reading pushed digest for ${push}`);
  const inspect = await runDocker(
    ["buildx", "imagetools", "inspect", push, "--format", "{{json .Manifest}}"],
    false,
  );
  if (inspect.code !== 0) {
    throw new Error(
      `docker buildx imagetools inspect failed (exit ${inspect.code})`,
    );
  }
  let digest: unknown;
  try {
    digest = (JSON.parse(inspect.stdout) as { digest?: unknown }).digest;
  } catch {
    throw new Error("could not parse the image manifest from docker buildx");
  }
  if (typeof digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error("docker buildx did not report an image digest");
  }

  const image = `${repoOfReference(push)}@${digest}`;
  logStep(`Setting service ${name} image to ${image}`);
  await runProjectsServicesSet({
    name,
    image,
    projectId: options.projectId,
  });
}
