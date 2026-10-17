import { describe, expect, it } from "vitest";
import {
  DEPLOYMENT_BLOCKED_CODE_TEXT,
  DEPLOYMENT_EVENT_LABELS,
  DEPLOYMENT_EVENT_TYPES,
  deploymentBlockedCodeText,
  deploymentEventLabel,
} from "./deployment-labels.js";

describe("deployment labels", () => {
  it("lists the event types in timeline order", () => {
    expect([...DEPLOYMENT_EVENT_TYPES]).toEqual([
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
    ]);
  });

  it("has exactly one label per event type", () => {
    expect(Object.keys(DEPLOYMENT_EVENT_LABELS).sort()).toEqual(
      [...DEPLOYMENT_EVENT_TYPES].sort(),
    );
  });

  it("uses the shared customer labels", () => {
    expect(DEPLOYMENT_EVENT_LABELS).toEqual({
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
    });
  });

  it("uses the shared blocked-code text", () => {
    expect(DEPLOYMENT_BLOCKED_CODE_TEXT).toEqual({
      PREVIOUS_VERSION_DRAINING:
        "The previous version is still finishing its calls. Try again when it stops, or deploy with Force.",
      FORCED_ROLLOUT_SHUTTING_DOWN:
        "A forced deploy is still ending calls on the previous version. Try again in a few seconds.",
    });
    expect(deploymentBlockedCodeText("PREVIOUS_VERSION_DRAINING")).toBe(
      DEPLOYMENT_BLOCKED_CODE_TEXT.PREVIOUS_VERSION_DRAINING,
    );
    expect(deploymentBlockedCodeText("SOMETHING_NEW")).toBeUndefined();
  });

  it("shows an unknown event type as sent", () => {
    expect(deploymentEventLabel("completed")).toBe("Deploy finished");
    expect(deploymentEventLabel("something_new")).toBe("something_new");
  });
});
