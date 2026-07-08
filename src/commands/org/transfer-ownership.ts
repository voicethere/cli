import { createDashboardApi } from "../../lib/dashboard-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireDashboardSession } from "../../lib/dashboard-session.js";

export async function runOrgTransferOwnership(
  newOwnerUserId: string,
): Promise<void> {
  const normalized = newOwnerUserId.trim();
  if (!normalized) {
    throw new Error("new owner user id is required");
  }

  logStep(`Transferring organization ownership to ${normalized}`);
  const session = await requireDashboardSession();
  const api = createDashboardApi(session.api_base, session.cookie);
  await api.transferOwnership(normalized);
  console.log("Ownership transfer complete.");
}
