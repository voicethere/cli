#!/usr/bin/env node

import { Command } from "commander";
import { runLogin } from "./commands/login.js";
import { runProjectsCreate } from "./commands/projects/create.js";
import { runProjectsList } from "./commands/projects/list.js";
import { runProjectsShow } from "./commands/projects/show.js";
import { runProjectsUse } from "./commands/projects/use.js";
import { runBuildPromote } from "./commands/build/promote.js";
import { runBuildList } from "./commands/build/list.js";
import { runBuildUpload } from "./commands/build/upload.js";
import { runBuildValidate } from "./commands/build/validate.js";
import { runDeployReserved } from "./commands/deploy.js";
import { DEFAULT_API_BASE } from "./lib/config.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("voicethere")
    .description("VoiceThere cloud CLI")
    .version("0.1.0");

  program
    .command("login")
    .description("Store API key and API base URL")
    .requiredOption("--api-key <key>", "VoiceThere API key (Bearer token)")
    .option("--api-base <url>", "API base URL", DEFAULT_API_BASE)
    .action(async (options: { apiKey: string; apiBase?: string }) => {
      await runLogin({
        apiKey: options.apiKey,
        apiBase: options.apiBase,
      });
    });

  const projects = program
    .command("projects")
    .description("Manage agent projects");

  projects
    .command("list")
    .description("List projects in your organization")
    .action(async () => {
      await runProjectsList();
    });

  projects
    .command("create")
    .description("Create a new project")
    .requiredOption("--name <name>", "Project display name")
    .option("--slug <slug>", "URL-safe slug (derived from name when omitted)")
    .option(
      "--no-link",
      "Do not write .voicethere/config.json in the current repo",
    )
    .option(
      "--bundle <path>",
      "Default bundle path stored in .voicethere/config.json",
      "dist/agent.js",
    )
    .action(
      async (options: {
        name: string;
        slug?: string;
        noLink?: boolean;
        bundle?: string;
      }) => {
        await runProjectsCreate({
          name: options.name,
          slug: options.slug,
          link: !options.noLink,
          bundle: options.bundle,
        });
      },
    );

  projects
    .command("use")
    .description("Link this repo to a platform project (.voicethere/config.json)")
    .requiredOption("--project <id>", "Project UUID")
    .option("--slug <slug>", "Project slug (metadata only)")
    .option("--name <name>", "Project display name (metadata only)")
    .option("--bundle <path>", "Default bundle path", "dist/agent.js")
    .action(
      async (options: {
        project: string;
        slug?: string;
        name?: string;
        bundle?: string;
      }) => {
        await runProjectsUse({
          project: options.project,
          slug: options.slug,
          name: options.name,
          bundle: options.bundle,
        });
      },
    );

  projects
    .command("show")
    .description("Show linked .voicethere/config.json for this repo")
    .action(async () => {
      await runProjectsShow();
    });

  const build = program.command("build").description("Agent bundle operations");

  build
    .command("validate")
    .description("Run @voicethere/agent sandbox verify on a bundle")
    .option(
      "--file <path>",
      "Bundle path (default: config bundle or dist/agent.js)",
    )
    .action(async (options: { file?: string }) => {
      await runBuildValidate({ file: options.file });
    });

  build
    .command("list")
    .description("List uploaded builds (newest first)")
    .option(
      "--project <id>",
      "Project UUID (default: .voicethere/config.json project_id)",
    )
    .action(async (options: { project?: string }) => {
      await runBuildList({ project: options.project });
    });

  build
    .command("upload")
    .description("Validate (unless skipped) and upload a bundle")
    .option(
      "--project <id>",
      "Project UUID (default: .voicethere/config.json project_id)",
    )
    .option(
      "--file <path>",
      "Bundle path (default: config bundle or dist/agent.js)",
    )
    .option("-m, --message <text>", "Build label (like a git commit message)")
    .option("--skip-validate", "Upload without local sandbox verify")
    .action(
      async (options: {
        project?: string;
        file?: string;
        message?: string;
        skipValidate?: boolean;
      }) => {
        await runBuildUpload({
          project: options.project,
          file: options.file,
          message: options.message,
          skipValidate: options.skipValidate,
        });
      },
    );

  build
    .command("promote")
    .description(
      "Set active build in the control plane (platform promote API; no cluster rollout)",
    )
    .argument("<buildId>", "Build UUID to promote (from build list or upload output)")
    .option(
      "--project <id>",
      "Project UUID (default: .voicethere/config.json project_id)",
    )
    .action(async (buildId: string, options: { project?: string }) => {
      await runBuildPromote({
        project: options.project,
        buildId,
      });
    });

  program
    .command("deploy")
    .description(
      "[Reserved] Promote + roll out to cluster runners (P5 — use build promote today)",
    )
    .action(async () => {
      await runDeployReserved();
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
