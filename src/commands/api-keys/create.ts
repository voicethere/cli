import {
  logCommandInfo,
  logResolvedProject,
  logStep,
} from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import {
  readProjectConfig,
  type ResolvedProjectId,
} from "../../lib/project-config.js";

export type ApiKeysCreateOptions = {
  name: string;
  kind?: "admin" | "client";
  /** Overrides the linked project in `.voicethere/config.json`. */
  projectId?: string;
  expiresInDays?: number;
};

const CLIENT_KEY_NEEDS_PROJECT =
  "Client API keys need a project. Pass --project-id <uuid>, or link one with: voicethere projects use <projectId>";

/**
 * Client keys bind to `--project-id` when set, otherwise the linked project.
 * Admin keys stay org-scoped and reject `--project-id`.
 */
async function resolveClientProjectId(
  explicitProjectId: string | undefined,
): Promise<string> {
  if (explicitProjectId) {
    logCommandInfo(`project: ${explicitProjectId} (--project-id)`);
    return explicitProjectId;
  }

  const linked = await readProjectConfig();
  const projectId = linked?.config.project_id?.trim();
  if (!linked || !projectId) {
    throw new Error(CLIENT_KEY_NEEDS_PROJECT);
  }

  const resolved: ResolvedProjectId = {
    projectId,
    source: "config",
    configPath: linked.path,
  };
  logResolvedProject(resolved);
  return projectId;
}

export async function runApiKeysCreate(
  options: ApiKeysCreateOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("Name is required");
  }

  const kind = options.kind ?? "admin";
  const explicitProjectId = options.projectId?.trim() || undefined;
  if (kind === "admin" && explicitProjectId) {
    throw new Error("--project-id is only valid for client API keys");
  }

  const projectId =
    kind === "client"
      ? await resolveClientProjectId(explicitProjectId)
      : undefined;

  logStep(`Creating ${kind} API key "${name}"`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const created = await api.createApiKey({
    name,
    kind,
    project_id: projectId,
    expires_in_days: options.expiresInDays,
  });

  console.log("");
  console.log("=== API key (shown once — store securely) ===");
  console.log(created.api_key);
  console.log("");
  console.log(`id: ${created.id}`);
  console.log(`kind: ${created.kind}`);
  if (created.project_id) {
    console.log(`project_id: ${created.project_id}`);
  }
}
