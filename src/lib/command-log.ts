import type { ResolvedBundlePath, ResolvedProjectId } from "./project-config.js";

let verbose = false;

function verboseFromEnv(): boolean {
  const value = process.env.VOICETHERE_VERBOSE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Call from CLI entry (and tests). `--verbose` OR `VOICETHERE_VERBOSE=1`. */
export function configureLogging(options: { verbose?: boolean } = {}): void {
  verbose = Boolean(options.verbose) || verboseFromEnv();
}

export function isVerbose(): boolean {
  return verbose;
}

/** Reset between tests. */
export function resetLoggingForTests(): void {
  verbose = false;
  delete process.env.VOICETHERE_VERBOSE;
}

/** Always-on workflow steps on stderr (safe for scripts — stdout stays machine-readable). */
export function logStep(message: string): void {
  console.error(`[voicethere] ${message}`);
}

/** Alias for path/context lines used at command start. */
export function logCommandInfo(message: string): void {
  logStep(message);
}

/** Extra detail when `--verbose` or `VOICETHERE_VERBOSE=1`. */
export function logVerbose(message: string): void {
  if (verbose) {
    console.error(`[voicethere:verbose] ${message}`);
  }
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
  logStep(`bundle: ${bundle.absolutePath} (${describeBundleSource(bundle)})`);
}

export function logResolvedProject(project: ResolvedProjectId): void {
  logStep(`project: ${project.projectId} (${describeProjectSource(project)})`);
}

export function logApiBase(apiBase: string): void {
  logVerbose(`api: ${apiBase}`);
}

export function logBuildPromoteContext(
  buildId: string,
  project: ResolvedProjectId,
): void {
  logStep(`build: ${buildId}`);
  logResolvedProject(project);
}
