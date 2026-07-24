import { createUserApi } from "../../lib/user-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireUserCommandSession } from "../../lib/user-session.js";

export async function runOrgsList(): Promise<void> {
  logStep("Listing organizations");
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  const response = await api.listOrgs();

  if (response.orgs.length === 0) {
    console.log("No organizations found.");
    return;
  }

  for (const org of response.orgs) {
    const active = org.id === response.active_org_id ? "*" : " ";
    const owner = org.is_owner ? "owner" : "member";
    console.log(`${active}\t${org.id}\t${org.slug}\t${org.name}\t${owner}`);
  }
}
