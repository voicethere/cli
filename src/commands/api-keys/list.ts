import { logStep, logVerbose } from "../../lib/command-log.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireCredentials } from "../../lib/config.js";

export type ApiKeysListOptions = Record<string, never>;

export async function runApiKeysList(
  _options: ApiKeysListOptions = {},
): Promise<void> {
  logStep("Listing API keys");

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.listApiKeys();
  logVerbose(`found ${result.api_keys.length} key(s)`);

  if (result.api_keys.length === 0) {
    console.log("No API keys.");
    return;
  }

  for (const key of result.api_keys) {
    const status = key.revoked_at
      ? "revoked"
      : new Date(key.expires_at).getTime() <= Date.now()
        ? "expired"
        : "active";
    const project = key.project_name ?? (key.project_id ? key.project_id : "—");
    console.log(
      `${key.id}\t${key.name}\t${key.kind}\t${key.key_prefix}…\t${project}\t${status}`,
    );
  }
}
