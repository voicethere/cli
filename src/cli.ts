#!/usr/bin/env node

import { Command } from "commander";
import { runLogin } from "./commands/login.js";
import { runProjectsCreate } from "./commands/projects/create.js";
import { runProjectsList } from "./commands/projects/list.js";
import { runBuildUpload } from "./commands/build/upload.js";
import { runBuildValidate } from "./commands/build/validate.js";
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
    .action(async (options: { name: string; slug?: string }) => {
      await runProjectsCreate({
        name: options.name,
        slug: options.slug,
      });
    });

  const build = program.command("build").description("Agent bundle operations");

  build
    .command("validate")
    .description("Run @voicethere/agent sandbox verify on a bundle")
    .option("--file <path>", "Bundle path", "dist/agent.js")
    .action(async (options: { file?: string }) => {
      await runBuildValidate({ file: options.file });
    });

  build
    .command("upload")
    .description("Validate (unless skipped) and upload a bundle")
    .requiredOption("--project <id>", "Project UUID")
    .option("--file <path>", "Bundle path", "dist/agent.js")
    .option("--skip-validate", "Upload without local sandbox verify")
    .action(
      async (options: {
        project: string;
        file?: string;
        skipValidate?: boolean;
      }) => {
        await runBuildUpload({
          project: options.project,
          file: options.file,
          skipValidate: options.skipValidate,
        });
      },
    );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
