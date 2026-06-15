import { createApi } from "../../lib/api.js";
import { logStep } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";

export type ApiKeysRevokeOptions = {
  id: string;
};

export async function runApiKeysRevoke(
  options: ApiKeysRevokeOptions,
): Promise<void> {
  const id = options.id.trim();
  if (!id) {
    throw new Error("API key id is required");
  }

  logStep(`Revoking API key ${id}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const revoked = await api.revokeApiKey(id);

  console.log(`Revoked ${revoked.name} (${revoked.key_prefix}…)`);
}
