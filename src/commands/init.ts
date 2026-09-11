import { spawn } from "node:child_process";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { slugifyName } from "./projects/create.js";
import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import { requireCredentials } from "../lib/config.js";
import { logCommandInfo, logStep, logVerbose } from "../lib/command-log.js";
import {
  buildCustomerPackageJson,
  CUSTOMER_GITIGNORE,
  defaultCustomerPackageName,
} from "../lib/customer-package-json.js";
import {
  assertPlatformCreateTemplateId,
  loadTemplateWorkspaceSources,
  resolveTemplateEntryPath,
} from "../lib/project-templates.js";
import { DEFAULT_BUNDLE, writeProjectConfig } from "../lib/project-config.js";
import type { ProjectSourceFile } from "../lib/api.js";

export interface InitOptions {
  /** Target directory (default: current working directory). */
  dir?: string;
  name?: string;
  slug?: string;
  template?: string;
  localOnly?: boolean;
  noInstall?: boolean;
  force?: boolean;
}

export async function runNpmInstall(cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npm", ["install"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`npm install exited with code ${code ?? "unknown"}`));
    });
  });
}

async function writeScaffoldFiles(
  targetDir: string,
  options: {
    templateId: string;
    packageName: string;
    entryPath: string;
  },
): Promise<ProjectSourceFile[]> {
  const templateSources = loadTemplateWorkspaceSources(options.templateId);
  const packageJson = buildCustomerPackageJson({
    templateId: options.templateId,
    entryPath: options.entryPath,
    packageName: options.packageName,
  });

  await mkdir(targetDir, { recursive: true });

  for (const file of templateSources) {
    const absolutePath = join(targetDir, file.path);
    await mkdir(dirnameFor(file.path, targetDir), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }

  await writeFile(join(targetDir, "package.json"), packageJson, "utf8");
  await writeFile(join(targetDir, ".gitignore"), CUSTOMER_GITIGNORE, "utf8");

  const pushFiles: ProjectSourceFile[] = [
    ...templateSources,
    { path: "package.json", content: packageJson },
  ];
  pushFiles.sort((a, b) => a.path.localeCompare(b.path));
  return pushFiles;
}

function dirnameFor(relativePath: string, rootDir: string): string {
  const segments = relativePath.split("/");
  if (segments.length <= 1) {
    return rootDir;
  }
  return join(rootDir, ...segments.slice(0, -1));
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const templateId = (options.template?.trim() || "echo").toLowerCase();
  assertPlatformCreateTemplateId(templateId);

  const targetDir = resolve(options.dir?.trim() || ".");
  const targetStat = await stat(targetDir).catch(() => null);
  if (targetStat && !targetStat.isDirectory()) {
    throw new Error(`Refusing to init over a non-directory path: ${targetDir}`);
  }

  const packageJsonPath = join(targetDir, "package.json");
  const packageExists = await access(packageJsonPath)
    .then(() => true)
    .catch(() => false);
  if (packageExists && !options.force) {
    throw new Error(
      `${packageJsonPath} already exists — use --force to overwrite or choose another directory`,
    );
  }

  const displayName = (options.name?.trim() || basename(targetDir)).trim();
  if (!displayName) {
    throw new Error(
      "project name is required (--name or a non-empty directory name)",
    );
  }

  const slug = (options.slug?.trim() || slugifyName(displayName)).replace(
    /^-+|-+$/g,
    "",
  );
  if (!slug) {
    throw new Error("Could not derive a valid slug; pass --slug explicitly");
  }

  const entryPath = resolveTemplateEntryPath(templateId);
  const packageName = defaultCustomerPackageName(templateId);

  logStep(`Scaffolding ${templateId} workspace in ${targetDir}`);
  const pushFiles = await writeScaffoldFiles(targetDir, {
    templateId,
    packageName,
    entryPath,
  });

  if (!options.localOnly) {
    const credentials = await requireCredentials();
    const api = createApiFromCredentials(credentials);

    logStep(
      `Creating cloud project "${displayName}" (slug=${slug}, template=${templateId})`,
    );
    const project = await api.createProject(displayName, slug, templateId);
    logVerbose(`project id: ${project.id}`);

    logStep("Writing .voicethere/config.json");
    const configPath = await writeProjectConfig(
      {
        project_id: project.id,
        project_slug: project.slug,
        name: project.name,
        bundle: DEFAULT_BUNDLE,
      },
      { startDir: targetDir },
    );
    logCommandInfo(`project config: ${configPath}`);

    logStep("Seeding dashboard Code workspace");
    const remote = await api.getProjectSource(project.id);
    const updated = await api.putProjectSource(project.id, {
      entry_path: entryPath,
      files: pushFiles,
      revision: remote.revision,
    });
    logVerbose(`source revision: ${remote.revision} → ${updated.revision}`);
  }

  if (!options.noInstall) {
    logStep("Running npm install");
    await runNpmInstall(targetDir);
  }

  const nextSteps = options.localOnly
    ? "Next: npm run verify"
    : "Next: edit sources, npm run verify, voicethere source push";
  console.error(nextSteps);
}
