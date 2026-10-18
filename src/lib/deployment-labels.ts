/**
 * Deployment history event types in timeline order, with the customer labels
 * shown in the dashboard, the CLI and the docs. Keep these in step with the
 * API contract; `deployment-labels.test.ts` pins the list.
 */
export const DEPLOYMENT_EVENT_TYPES = [
  "requested",
  "blocked",
  "started",
  "new_version_ready",
  "routing_switched",
  "previous_version_draining",
  "force_end",
  "force_end_failed",
  "completed",
  "failed",
  "previous_version_stopped",
] as const;

export type DeploymentEventType = (typeof DEPLOYMENT_EVENT_TYPES)[number];

export const DEPLOYMENT_EVENT_LABELS: Record<DeploymentEventType, string> = {
  requested: "Deploy requested",
  blocked: "Deploy refused",
  started: "Rollout started",
  new_version_ready: "New version ready",
  routing_switched: "New calls go to the new version",
  previous_version_draining: "Previous version finishing its calls",
  force_end: "Calls on the previous version ended",
  force_end_failed: "Ending calls on the previous version failed",
  completed: "Deploy finished",
  failed: "Deploy failed",
  previous_version_stopped: "Previous version stopped",
};

/** Customer text for the `code` detail of a `blocked` event. */
export const DEPLOYMENT_BLOCKED_CODE_TEXT: Record<string, string> = {
  PREVIOUS_VERSION_DRAINING:
    "The previous version is still finishing its calls. Try again when it stops, or deploy with Force.",
  FORCED_ROLLOUT_SHUTTING_DOWN:
    "A forced deploy is still ending calls on the previous version. Try again in a few seconds.",
};

/** Label for an event type; an unknown type (newer API) is shown as sent. */
export function deploymentEventLabel(type: string): string {
  return (DEPLOYMENT_EVENT_LABELS as Record<string, string>)[type] ?? type;
}

/** Customer text for a blocked code, or undefined when the code is unknown. */
export function deploymentBlockedCodeText(code: string): string | undefined {
  return DEPLOYMENT_BLOCKED_CODE_TEXT[code];
}

const REFUSED_FAILURE_CODES = new Set([
  "PREVIOUS_VERSION_DRAINING",
  "FORCED_ROLLOUT_SHUTTING_DOWN",
]);

/** A customer-class failure that is a refusal at the door: nothing in the agent to fix. */
export function isRefusedFailure(failure: {
  class: string;
  code: string;
}): boolean {
  return failure.class === "customer" && REFUSED_FAILURE_CODES.has(failure.code);
}
