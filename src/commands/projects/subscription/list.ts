import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";

export async function runProjectsSubscriptionList(): Promise<void> {
  logStep("Listing organization subscriptions");
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const subscriptions = await api.listSubscriptions();

  if (subscriptions.length === 0) {
    console.log("No subscriptions found.");
    return;
  }

  for (const subscription of subscriptions) {
    console.log(
      [
        subscription.id,
        `tier=${subscription.tier}`,
        `status=${subscription.status}`,
        `project_id=${subscription.project_id ?? "none"}`,
        `price_id=${subscription.price_id ?? "none"}`,
      ].join("\t"),
    );
  }
}
