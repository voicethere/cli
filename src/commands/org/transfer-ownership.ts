import { createUserApi } from "../../lib/user-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireUserCommandSession } from "../../lib/user-session.js";

export async function runOrgTransferOwnership(
  newOwnerUserId: string,
): Promise<void> {
  const normalized = newOwnerUserId.trim();
  if (!normalized) {
    throw new Error("new owner user id is required");
  }

  logStep(`Transferring organization ownership to ${normalized}`);
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  await api.transferOwnership(normalized);
  console.log("Ownership transfer complete.");
}
