import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ALLOWED_SUFFIXES = [".d.ts", ".tsx", ".ts", ".js", ".json"] as const;

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".git",
  ".test-logs",
  ".voicethere",
]);

/** Paths never uploaded via source push (local-only). */
const SKIP_FILE_PATHS = new Set([".gitignore", ".voicethere/config.json"]);

export interface WorkspaceSourceFile {
  path: string;
  content: string;
}

function hasAllowedSuffix(relativePath: string): boolean {
  return ALLOWED_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

function shouldSkipFile(relativePath: string): boolean {
  if (SKIP_FILE_PATHS.has(relativePath)) {
    return true;
  }
  const segments = relativePath.split("/");
  return segments.some((segment) => SKIP_DIR_NAMES.has(segment));
}

async function collectFilesRecursive(
  rootDir: string,
  currentDir: string,
  files: WorkspaceSourceFile[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      await collectFilesRecursive(rootDir, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }
    if (shouldSkipFile(relativePath) || !hasAllowedSuffix(relativePath)) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    files.push({ path: relativePath, content });
  }
}

/** Collect pushable workspace files under repoRoot (parent of `.voicethere/`). */
export async function collectWorkspaceSourceFiles(
  repoRoot: string,
): Promise<WorkspaceSourceFile[]> {
  const rootStat = await stat(repoRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`Workspace root is not a directory: ${repoRoot}`);
  }

  const files: WorkspaceSourceFile[] = [];
  await collectFilesRecursive(repoRoot, repoRoot, files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

/** Parse `--entry` from the customer package.json build script, if present. */
export function parseEntryPathFromPackageJson(
  packageJsonContent: string,
): string | null {
  try {
    const parsed = JSON.parse(packageJsonContent) as {
      scripts?: { build?: string };
    };
    const buildScript = parsed.scripts?.build;
    if (!buildScript) {
      return null;
    }
    const match = /--entry\s+(\S+)/.exec(buildScript);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function resolveWorkspaceEntryPath(
  files: WorkspaceSourceFile[],
  remoteEntryPath: string | undefined,
): string {
  const trimmedRemote = remoteEntryPath?.trim();
  if (trimmedRemote) {
    return trimmedRemote;
  }

  const packageJson = files.find((file) => file.path === "package.json");
  if (packageJson) {
    const fromScript = parseEntryPathFromPackageJson(packageJson.content);
    if (fromScript) {
      return fromScript;
    }
  }

  if (files.some((file) => file.path === "agent.ts")) {
    return "agent.ts";
  }

  const tsEntry = files.find(
    (file) => file.path.endsWith(".ts") && !file.path.includes("/"),
  );
  if (tsEntry) {
    return tsEntry.path;
  }

  throw new Error(
    "Could not determine entry_path — ensure package.json build script includes --entry",
  );
}
