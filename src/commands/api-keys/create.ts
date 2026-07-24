import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";

export type ApiKeysCreateOptions = {
  name: string;
  kind?: "admin" | "client";
  projectId?: string;
  expiresInDays?: number;
};

export async function runApiKeysCreate(
  options: ApiKeysCreateOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("Name is required");
  }

  const kind = options.kind ?? "admin";
  if (kind === "client" && !options.projectId?.trim()) {
    throw new Error("--project-id is required for client API keys");
  }
  if (kind === "admin" && options.projectId?.trim()) {
    throw new Error("--project-id is only valid for client API keys");
  }

  logStep(`Creating ${kind} API key "${name}"`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const created = await api.createApiKey({
    name,
    kind,
    project_id: options.projectId?.trim(),
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
