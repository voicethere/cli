import { describe, expect, it } from "vitest";

import { formatProjectSubscriptionOutput } from "./format-output.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const SUBSCRIPTION_ID = "22222222-2222-2222-2222-222222222222";

describe("formatProjectSubscriptionOutput", () => {
  it("omits settingGrants and includes capacity fields from entitlement_snapshot.runner", () => {
    const formatted = formatProjectSubscriptionOutput({
      project_id: PROJECT_ID,
      subscription: {
        id: SUBSCRIPTION_ID,
        org_id: "org-1",
        project_id: PROJECT_ID,
        tier: "advanced" as "free",
        price_id: "price_advanced",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        canceled_at: null,
        billing_source: "internal",
        stripe_subscription_id: "sub_stripe",
        entitlement_snapshot: {
          settingGrants: {
            "runner.mode": { enabled: true },
            "voice.tts_provider": { enabled: true, default: "cartesia" },
          },
          runner: {
            data: {
              maxPodsDefault: 3,
              maxTotalConcurrentConnections: 60,
              maxActiveConnectionsPerPod: 20,
              warmPoolEnabledDefault: false,
              warmPoolMinPodsDefault: 0,
              maxMonthlyBillableMinutes: 99999,
              resources: { requests: { cpu: "1", memory: "2Gi" }, limits: {} },
            },
            voice: {},
            "voice+data": {
              maxPodsDefault: 1,
              maxTotalConcurrentConnections: 20,
              maxActiveConnectionsPerPod: 20,
              warmPoolEnabledDefault: true,
              warmPoolMinPodsDefault: 1,
            },
          },
        },
      },
    });

    const json = JSON.stringify(formatted);
    expect(json).not.toContain("settingGrants");
    expect(json).not.toContain("stripe");
    expect(json).not.toContain("millicredits");
    expect(formatted.subscription).toMatchObject({
      id: SUBSCRIPTION_ID,
      tier: "advanced",
      status: "active",
      billing_source: "internal",
      capacity: {
        data: {
          maxPodsDefault: 3,
          maxTotalConcurrentConnections: 60,
          maxActiveConnectionsPerPod: 20,
          warmPoolEnabledDefault: false,
          warmPoolMinPodsDefault: 0,
        },
        "voice+data": {
          maxPodsDefault: 1,
          maxTotalConcurrentConnections: 20,
          maxActiveConnectionsPerPod: 20,
          warmPoolEnabledDefault: true,
          warmPoolMinPodsDefault: 1,
        },
      },
    });
    expect(formatted.subscription?.capacity).not.toHaveProperty("voice");

    const parsed = JSON.parse(json) as {
      project_id: string;
      subscription: { id: string } | null;
    };
    expect(parsed.project_id).toBe(PROJECT_ID);
    expect(parsed.subscription?.id).toBe(SUBSCRIPTION_ID);
  });

  it("returns null subscription when unassigned", () => {
    const formatted = formatProjectSubscriptionOutput({
      project_id: PROJECT_ID,
      subscription: null,
    });

    expect(formatted).toEqual({
      project_id: PROJECT_ID,
      subscription: null,
    });
  });

  it("omits capacity when entitlement_snapshot.runner is missing", () => {
    const formatted = formatProjectSubscriptionOutput({
      project_id: PROJECT_ID,
      subscription: {
        id: SUBSCRIPTION_ID,
        org_id: "org-1",
        project_id: PROJECT_ID,
        tier: "free",
        price_id: null,
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        canceled_at: null,
      },
    });

    expect(formatted.subscription).toEqual({
      id: SUBSCRIPTION_ID,
      tier: "free",
      status: "active",
    });
    expect(formatted.subscription).not.toHaveProperty("capacity");
  });
});
