import { patchCredentials } from "../../lib/config.js";
import { createUserApi } from "../../lib/user-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireUserCommandSession } from "../../lib/user-session.js";

export async function runOrgsUse(orgId: string): Promise<void> {
  const normalized = orgId.trim();
  if (!normalized) {
    throw new Error("org id is required");
  }

  logStep(`Setting active organization to ${normalized}`);
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  await api.setActiveOrg(normalized);

  if (session.auth.kind === "user_api_key") {
    await patchCredentials({ active_org_id: normalized });
  }

  console.log(`Active organization set to ${normalized}`);
}
