import { createDashboardApi } from "../../lib/dashboard-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireDashboardSession } from "../../lib/dashboard-session.js";

export async function runOrgsUse(orgId: string): Promise<void> {
  const normalized = orgId.trim();
  if (!normalized) {
    throw new Error("org id is required");
  }

  logStep(`Setting active organization to ${normalized}`);
  const session = await requireDashboardSession();
  const api = createDashboardApi(session.api_base, session.cookie);
  await api.setActiveOrg(normalized);
  console.log(`Active organization set to ${normalized}`);
}
