import { describe, expect, it } from "vitest";
import type { DeploymentEvent, DeploymentSummary } from "../../lib/api.js";
import {
  formatDeploymentList,
  formatDeploymentTimeline,
  formatMinSec,
} from "./format.js";

const drainJob: DeploymentSummary = {
  id: "11111111-aaaa-4bbb-8ccc-000000000001",
  build_id: "a1b2c3d4-0000-4000-8000-000000000000",
  mode: "drain",
  status: "completed",
  error: null,
  created_at: "2026-10-17T12:00:00.000Z",
  completed_at: "2026-10-17T12:02:05.000Z",
  last_event_at: "2026-10-17T12:09:30.000Z",
  event_count: 6,
};

const forceJob: DeploymentSummary = {
  id: "22222222-aaaa-4bbb-8ccc-000000000002",
  build_id: "e5f6a7b8-0000-4000-8000-000000000000",
  mode: "force",
  status: "completed",
  error: null,
  created_at: "2026-10-17T10:30:00.000Z",
  completed_at: "2026-10-17T10:30:42.000Z",
  last_event_at: "2026-10-17T10:30:42.000Z",
  event_count: 5,
};

const blockedJob: DeploymentSummary = {
  id: "33333333-aaaa-4bbb-8ccc-000000000003",
  build_id: "c9d0e1f2-0000-4000-8000-000000000000",
  mode: "drain",
  status: "failed",
  error: "PREVIOUS_VERSION_DRAINING",
  created_at: "2026-10-17T09:00:00.000Z",
  completed_at: "2026-10-17T09:00:01.000Z",
  last_event_at: "2026-10-17T09:00:01.000Z",
  event_count: 2,
};

const runningJob: DeploymentSummary = {
  ...drainJob,
  id: "44444444-aaaa-4bbb-8ccc-000000000004",
  status: "active",
  completed_at: null,
  last_event_at: null,
  event_count: 0,
};

function event(
  type: string,
  occurred_at: string,
  details: Record<string, unknown> = {},
): DeploymentEvent {
  return { id: `ev-${type}`, type, occurred_at, details };
}

describe("formatMinSec", () => {
  it("formats m:ss without capping minutes", () => {
    expect(formatMinSec(0)).toBe("0:00");
    expect(formatMinSec(65_000)).toBe("1:05");
    expect(formatMinSec(4_503_000)).toBe("75:03");
    expect(formatMinSec(-5_000)).toBe("0:00");
  });
});

describe("formatDeploymentList", () => {
  it("prints the table and the next cursor", () => {
    expect(
      formatDeploymentList(
        [drainJob, forceJob, blockedJob, runningJob],
        "2026-10-17T09:00:00.000Z",
      ),
    ).toEqual([
      "Started (UTC)        Build     Mode   Status     By  Duration  Last event (UTC)",
      "2026-10-17 12:00:00  a1b2c3d4  drain  completed  -   2:05      2026-10-17 12:09:30",
      "2026-10-17 10:30:00  e5f6a7b8  force  completed  -   0:42      2026-10-17 10:30:42",
      "2026-10-17 09:00:00  c9d0e1f2  drain  failed     -   0:01      2026-10-17 09:00:01",
      "2026-10-17 12:00:00  a1b2c3d4  drain  active     -   -         -",
      "next: --before 2026-10-17T09:00:00.000Z",
    ]);
  });

  it("list shows the requester in a By column", () => {
    const byKey: DeploymentSummary = {
      ...drainJob,
      requested_by: { kind: "personal_api_key", label: "Key: ci-deploy" },
    };
    const byUnknown: DeploymentSummary = {
      ...forceJob,
      requested_by: { kind: "unknown", label: null },
    };
    const lines = formatDeploymentList([byKey, byUnknown], null);
    expect(lines).toEqual([
      "Started (UTC)        Build     Mode   Status     By              Duration  Last event (UTC)",
      "2026-10-17 12:00:00  a1b2c3d4  drain  completed  Key: ci-deploy  2:05      2026-10-17 12:09:30",
      "2026-10-17 10:30:00  e5f6a7b8  force  completed  -               0:42      2026-10-17 10:30:42",
    ]);
    const [header, row1, row2] = lines as [string, string, string];
    expect(header).toContain("By");
    expect(row1).toContain("Key: ci-deploy");
    const durationOffset = header.indexOf("Duration");
    expect(row1.slice(durationOffset)).toMatch(/^2:05 /);
    expect(row2.slice(durationOffset)).toMatch(/^0:42 /);
    expect(row2.slice(header.indexOf("By"))).toMatch(/^- {15}0:42/);
  });

  it("list without requested_by from an older server shows -", () => {
    const lines = formatDeploymentList([forceJob], null);
    expect(forceJob.requested_by).toBeUndefined();
    expect(lines[0]).toContain("By");
    expect(lines[1]).toContain("completed  -   0:42");
  });

  it("omits the cursor on the last page", () => {
    const lines = formatDeploymentList([forceJob], null);
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).not.toContain("next:");
  });

  it("says so when there are no deployments", () => {
    expect(formatDeploymentList([], null)).toEqual(["No deployments yet."]);
  });
});

describe("formatDeploymentTimeline", () => {
  it("prints a drain deploy, including the late stop", () => {
    expect(
      formatDeploymentTimeline(
        drainJob,
        [
          event("requested", "2026-10-17T12:00:00.000Z", { mode: "drain" }),
          event("started", "2026-10-17T12:00:02.000Z", {
            mode: "drain",
            redeploy: true,
          }),
          event("new_version_ready", "2026-10-17T12:01:40.000Z", {
            ready_pods: 2,
          }),
          event("routing_switched", "2026-10-17T12:01:41.000Z", {
            from_releases: 1,
          }),
          event("previous_version_draining", "2026-10-17T12:01:42.000Z", {
            pods: 2,
          }),
          event("completed", "2026-10-17T12:02:05.000Z"),
          event("previous_version_stopped", "2026-10-17T12:09:30.000Z", {
            drain_duration_ms: 468_000,
          }),
        ],
        false,
      ),
    ).toEqual([
      "11111111-aaaa-4bbb-8ccc-000000000001  build a1b2c3d4  drain  completed  started 2026-10-17 12:00:00 UTC",
      "12:00:00 UTC  +0:00  Deploy requested                      mode=drain",
      "12:00:02 UTC  +0:02  Rollout started                       mode=drain",
      "12:01:40 UTC  +1:40  New version ready                     runners=2",
      "12:01:41 UTC  +1:41  New calls go to the new version       versions=1",
      "12:01:42 UTC  +1:42  Previous version finishing its calls  runners=2",
      "12:02:05 UTC  +2:05  Deploy finished",
      "12:09:30 UTC  +9:30  Previous version stopped              drained in 7:48",
    ]);
  });

  it("prints a force deploy", () => {
    expect(
      formatDeploymentTimeline(
        forceJob,
        [
          event("requested", "2026-10-17T10:30:00.000Z", { mode: "force" }),
          event("started", "2026-10-17T10:30:01.000Z", { mode: "force" }),
          event("force_end", "2026-10-17T10:30:20.000Z", {
            pods: 3,
            releases: 1,
          }),
          event("force_end_failed", "2026-10-17T10:30:21.000Z", {
            error: "timed out",
          }),
          event("completed", "2026-10-17T10:30:42.000Z"),
        ],
        false,
      ),
    ).toEqual([
      "22222222-aaaa-4bbb-8ccc-000000000002  build e5f6a7b8  force  completed  started 2026-10-17 10:30:00 UTC",
      "10:30:00 UTC  +0:00  Deploy requested                             mode=force",
      "10:30:01 UTC  +0:01  Rollout started                              mode=force",
      "10:30:20 UTC  +0:20  Calls on the previous version ended          runners=3  versions=1",
      "10:30:21 UTC  +0:21  Ending calls on the previous version failed  error: timed out",
      "10:30:42 UTC  +0:42  Deploy finished",
    ]);
  });

  it("prints a refused deploy with the customer text for the code", () => {
    expect(
      formatDeploymentTimeline(
        blockedJob,
        [
          event("requested", "2026-10-17T09:00:00.000Z", { mode: "drain" }),
          event("blocked", "2026-10-17T09:00:01.000Z", {
            code: "PREVIOUS_VERSION_DRAINING",
            retiring_pods: 2,
          }),
        ],
        false,
      ),
    ).toEqual([
      "33333333-aaaa-4bbb-8ccc-000000000003  build c9d0e1f2  drain  failed  started 2026-10-17 09:00:00 UTC",
      "09:00:00 UTC  +0:00  Deploy requested  mode=drain",
      "09:00:01 UTC  +0:01  Deploy refused    The previous version is still finishing its calls. Try again when it stops, or deploy with Force.  runners retiring=2",
    ]);
  });

  it("show prints Requested by under the header", () => {
    const lines = formatDeploymentTimeline(
      {
        ...forceJob,
        requested_by: { kind: "user", label: "alice@example.com" },
      },
      [event("requested", "2026-10-17T10:30:00.000Z")],
      false,
    );
    expect(lines[0]).toContain("started 2026-10-17 10:30:00 UTC");
    expect(lines[1]).toBe("Requested by: alice@example.com");
    expect(lines[2]).toBe("10:30:00 UTC  +0:00  Deploy requested");
  });

  it("show prints Requested by: - when the requester is unknown", () => {
    const lines = formatDeploymentTimeline(
      { ...forceJob, requested_by: { kind: "unknown", label: null } },
      [event("requested", "2026-10-17T10:30:00.000Z")],
      false,
    );
    expect(lines[1]).toBe("Requested by: -");
  });

  it("show omits the Requested by line when the server does not send requested_by", () => {
    const lines = formatDeploymentTimeline(
      forceJob,
      [event("requested", "2026-10-17T10:30:00.000Z")],
      false,
    );
    expect(lines.join("\n")).not.toContain("Requested by");
    expect(lines[1]).toBe("10:30:00 UTC  +0:00  Deploy requested");
  });

  it("marks a derived timeline", () => {
    expect(
      formatDeploymentTimeline(
        forceJob,
        [
          event("requested", "2026-10-17T10:30:00.000Z"),
          event("completed", "2026-10-17T10:30:42.000Z"),
        ],
        true,
      ),
    ).toEqual([
      "22222222-aaaa-4bbb-8ccc-000000000002  build e5f6a7b8  force  completed  started 2026-10-17 10:30:00 UTC",
      "10:30:00 UTC  +0:00  Deploy requested",
      "10:30:42 UTC  +0:42  Deploy finished",
      "(start and end only)",
    ]);
  });

  it("shows an unknown event type as sent and ignores unknown details", () => {
    const lines = formatDeploymentTimeline(
      forceJob,
      [event("something_new", "2026-10-17T10:30:05.000Z", { extra: "x" })],
      false,
    );
    expect(lines[1]).toBe("10:30:05 UTC  +0:05  something_new");
  });
});
