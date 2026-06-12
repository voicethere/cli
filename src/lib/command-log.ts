import type { ResolvedBundlePath, ResolvedProjectId } from "./project-config.js";

export function logCommandInfo(message: string): void {
  console.error(`[voicethere] ${message}`);
}

function describeBundleSource(bundle: ResolvedBundlePath): string {
  switch (bundle.source) {
    case "argument":
      return "CLI argument";
    case "config":
      return bundle.configPath
        ? `project config (${bundle.configPath})`
        : "project config";
    case "default":
      return "default (dist/agent.js)";
  }
}

function describeProjectSource(project: ResolvedProjectId): string {
  return `project config (${project.configPath})`;
}

export function logResolvedBundle(bundle: ResolvedBundlePath): void {
  logCommandInfo(
    `bundle: ${bundle.absolutePath} (${describeBundleSource(bundle)})`,
  );
}

export function logResolvedProject(project: ResolvedProjectId): void {
  logCommandInfo(
    `project: ${project.projectId} (${describeProjectSource(project)})`,
  );
}

export function logBuildPromoteContext(
  buildId: string,
  project: ResolvedProjectId,
): void {
  logCommandInfo(`build: ${buildId}`);
  logResolvedProject(project);
}
