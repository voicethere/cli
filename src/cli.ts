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
    .version("0.2.0");

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
    .argument("<name>", "Project display name")
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
      async (
        name: string,
        options: {
          slug?: string;
          noLink?: boolean;
          bundle?: string;
        },
      ) => {
        await runProjectsCreate({
          name,
          slug: options.slug,
          link: !options.noLink,
          bundle: options.bundle,
        });
      },
    );

  projects
    .command("use")
    .description(
      "Use a project for this repo (.voicethere/config.json)",
    )
    .argument(
      "[projectId]",
      "Project UUID (interactive picker when omitted in a TTY)",
    )
    .option("--slug <slug>", "Override project slug in local config")
    .option("--name <name>", "Override display name in local config")
    .option("--bundle <path>", "Default bundle path", "dist/agent.js")
    .action(
      async (
        projectId: string | undefined,
        options: {
          slug?: string;
          name?: string;
          bundle?: string;
        },
      ) => {
        await runProjectsUse({
          projectId,
          slug: options.slug,
          name: options.name,
          bundle: options.bundle,
        });
      },
    );

  projects
    .command("show")
    .description("Show the active project (.voicethere/config.json)")
    .action(async () => {
      await runProjectsShow();
    });

  const build = program.command("build").description("Agent bundle operations");

  build
    .command("validate")
    .description("Run @voicethere/agent sandbox verify on a bundle")
    .argument(
      "[file]",
      "Bundle path (default: config bundle or dist/agent.js)",
    )
    .action(async (file?: string) => {
      await runBuildValidate({ file });
    });

  build
    .command("list")
    .description("List uploaded builds for the active project (newest first)")
    .action(async () => {
      await runBuildList();
    });

  build
    .command("upload")
    .description("Validate (unless skipped) and upload a bundle")
    .argument(
      "[file]",
      "Bundle path (default: config bundle or dist/agent.js)",
    )
    .option("-m, --message <text>", "Build label (like a git commit message)")
    .option("--skip-validate", "Upload without local sandbox verify")
    .action(
      async (
        file: string | undefined,
        options: {
          message?: string;
          skipValidate?: boolean;
        },
      ) => {
        await runBuildUpload({
          file,
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
    .argument(
      "[buildId]",
      "Build UUID (interactive picker when omitted in a TTY)",
    )
    .action(async (buildId?: string) => {
      await runBuildPromote({ buildId });
    });

  program
    .command("deploy")
    .description(
      "[Coming soon] Promote + roll out to cloud runners (use build promote today)",
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
