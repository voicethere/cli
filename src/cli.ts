#!/usr/bin/env node

import { Command } from "commander";
import { runApiKeysCreate } from "./commands/api-keys/create.js";
import { runApiKeysList } from "./commands/api-keys/list.js";
import { runApiKeysRevoke } from "./commands/api-keys/revoke.js";
import { runLogin } from "./commands/login.js";
import { runProjectsCreate } from "./commands/projects/create.js";
import { runProjectsDelete } from "./commands/projects/delete.js";
import { runProjectsEnvironmentDelete } from "./commands/projects/environment/delete.js";
import { runProjectsEnvironmentList } from "./commands/projects/environment/list.js";
import { runProjectsEnvironmentUpsert } from "./commands/projects/environment/upsert.js";
import { runProjectsEnvironmentView } from "./commands/projects/environment/view.js";
import { runProjectsSecretsCreate } from "./commands/projects/secrets/create.js";
import { runProjectsSecretsDelete } from "./commands/projects/secrets/delete.js";
import { runProjectsSecretsList } from "./commands/projects/secrets/list.js";
import { runProjectsSettingsList } from "./commands/projects/settings/list.js";
import { runProjectsSettingsSet } from "./commands/projects/settings/set.js";
import { runProjectsList } from "./commands/projects/list.js";
import { runProjectsShow } from "./commands/projects/show.js";
import { runProjectsUse } from "./commands/projects/use.js";
import { runBuildPromote } from "./commands/build/promote.js";
import { runBuildList } from "./commands/build/list.js";
import { runBuildUpload } from "./commands/build/upload.js";
import { runBuildValidate } from "./commands/build/validate.js";
import { runDeploy } from "./commands/deploy.js";
import { runUndeploy } from "./commands/undeploy.js";
import { configureLogging } from "./lib/command-log.js";
import { DEFAULT_API_BASE } from "./lib/config.js";

async function main(): Promise<void> {
  configureLogging();

  const program = new Command();

  program
    .name("voicethere")
    .description("VoiceThere cloud CLI")
    .version("0.2.2")
    .option("-v, --verbose", "Detailed logs on stderr (API calls, timings)")
    .hook("preAction", (_thisCommand, actionCommand) => {
      configureLogging({ verbose: actionCommand.optsWithGlobals().verbose });
    });

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
    .description("Use a project for this repo (.voicethere/config.json)")
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

  projects
    .command("delete")
    .description("Delete a project and all its builds")
    .argument(
      "[projectId]",
      "Project UUID (default: active project from .voicethere/config.json)",
    )
    .option("--force", "Skip interactive name confirmation")
    .action(
      async (projectId: string | undefined, options: { force?: boolean }) => {
        await runProjectsDelete({
          projectId,
          force: options.force,
        });
      },
    );

  const environment = projects
    .command("environment")
    .description("Manage non-secret AGENT_* variables for the active project");

  environment
    .command("list")
    .description("List environment variables")
    .option("--project <id>", "Project UUID (default: .voicethere/config.json)")
    .action(async (options: { project?: string }) => {
      await runProjectsEnvironmentList({ projectId: options.project });
    });

  environment
    .command("view")
    .description("View one environment variable")
    .argument("<key>", "Variable name (e.g. AGENT_GREETING)")
    .option("--project <id>", "Project UUID")
    .action(async (key: string, options: { project?: string }) => {
      await runProjectsEnvironmentView({ key, projectId: options.project });
    });

  environment
    .command("create")
    .description("Create an environment variable")
    .argument("<key>", "Variable name")
    .argument("<value>", "Variable value")
    .option("--project <id>", "Project UUID")
    .action(
      async (key: string, value: string, options: { project?: string }) => {
        await runProjectsEnvironmentUpsert({
          key,
          value,
          projectId: options.project,
        });
      },
    );

  environment
    .command("update")
    .description("Create or update an environment variable")
    .argument("<key>", "Variable name")
    .argument("<value>", "Variable value")
    .option("--project <id>", "Project UUID")
    .action(
      async (key: string, value: string, options: { project?: string }) => {
        await runProjectsEnvironmentUpsert({
          key,
          value,
          projectId: options.project,
        });
      },
    );

  environment
    .command("delete")
    .description("Delete an environment variable")
    .argument("<key>", "Variable name")
    .option("--project <id>", "Project UUID")
    .action(async (key: string, options: { project?: string }) => {
      await runProjectsEnvironmentDelete({ key, projectId: options.project });
    });

  const secrets = projects
    .command("secrets")
    .description("Manage encrypted AGENT_* secrets for the active project");

  secrets
    .command("list")
    .description("List secrets (masked values only)")
    .option("--project <id>", "Project UUID")
    .action(async (options: { project?: string }) => {
      await runProjectsSecretsList({ projectId: options.project });
    });

  secrets
    .command("create")
    .description("Create a secret (delete + recreate to change value)")
    .argument("<name>", "Secret name (e.g. AGENT_API_KEY)")
    .argument("<value>", "Secret value")
    .option("--project <id>", "Project UUID")
    .action(
      async (name: string, value: string, options: { project?: string }) => {
        await runProjectsSecretsCreate({
          name,
          value,
          projectId: options.project,
        });
      },
    );

  secrets
    .command("delete")
    .description("Delete a secret")
    .argument("<name>", "Secret name")
    .option("--project <id>", "Project UUID")
    .action(async (name: string, options: { project?: string }) => {
      await runProjectsSecretsDelete({ name, projectId: options.project });
    });

  const settings = projects
    .command("settings")
    .description("Runner pool settings (warm pool, idle scale-down)");

  settings
    .command("list")
    .description("List runner settings for the active project")
    .option("--project <id>", "Project UUID")
    .action(async (options: { project?: string }) => {
      await runProjectsSettingsList({ projectId: options.project });
    });

  settings
    .command("set")
    .description("Set a runner setting")
    .argument(
      "<name>",
      "Setting name (warm_pool_enabled, idle_scale_down_seconds)",
    )
    .argument("<value>", "Setting value")
    .option("--project <id>", "Project UUID")
    .action(
      async (name: string, value: string, options: { project?: string }) => {
        await runProjectsSettingsSet({
          name,
          value,
          projectId: options.project,
        });
      },
    );

  const build = program.command("build").description("Agent bundle operations");

  build
    .command("validate")
    .description("Run @voicethere/agent sandbox verify on a bundle")
    .argument("[file]", "Bundle path (default: config bundle or dist/agent.js)")
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
    .argument("[file]", "Bundle path (default: config bundle or dist/agent.js)")
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

  const apiKeys = program
    .command("api-keys")
    .description("Manage organization API keys");

  apiKeys
    .command("list")
    .description("List API keys (prefix and permissions only)")
    .action(async () => {
      await runApiKeysList();
    });

  apiKeys
    .command("create")
    .description("Create an API key (plaintext shown once)")
    .requiredOption("--name <name>", "Display name for the key")
    .option("--kind <kind>", "admin or client", "admin")
    .option("--project-id <id>", "Project UUID (required for client keys)")
    .option("--expires-in-days <days>", "Lifetime in days (max 180)", (value) =>
      Number.parseInt(value, 10),
    )
    .action(
      async (options: {
        name: string;
        kind?: string;
        projectId?: string;
        expiresInDays?: number;
      }) => {
        const kind = options.kind === "client" ? "client" : "admin";
        await runApiKeysCreate({
          name: options.name,
          kind,
          projectId: options.projectId,
          expiresInDays: options.expiresInDays,
        });
      },
    );

  apiKeys
    .command("revoke")
    .description("Revoke an API key by id")
    .argument("<id>", "API key UUID")
    .action(async (id: string) => {
      await runApiKeysRevoke({ id });
    });

  program
    .command("deploy")
    .description("Promote (if needed) and roll out to cloud runners")
    .option("--project <id>", "Project UUID (default: .voicethere/config.json)")
    .option(
      "--build-id <id>",
      "Build UUID (default: active or newest passed build)",
    )
    .option("--mode <mode>", "Rollout mode: drain or force", "drain")
    .option("--wait", "Poll until deployment completes or fails")
    .action(
      async (options: {
        project?: string;
        buildId?: string;
        mode?: string;
        wait?: boolean;
      }) => {
        const mode = options.mode === "force" ? "force" : "drain";
        await runDeploy({
          projectId: options.project,
          buildId: options.buildId,
          mode,
          wait: options.wait,
        });
      },
    );

  program
    .command("undeploy")
    .description("Remove runner deployments for a project from the cluster")
    .option("--project <id>", "Project UUID (default: .voicethere/config.json)")
    .option("--wait", "Poll until undeploy completes or fails")
    .action(async (options: { project?: string; wait?: boolean }) => {
      await runUndeploy({
        projectId: options.project,
        wait: options.wait,
      });
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
