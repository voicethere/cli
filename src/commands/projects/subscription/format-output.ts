import type { ProjectSubscriptionResponse } from "../../../lib/api.js";

const CAPACITY_KEYS = [
  "maxPodsDefault",
  "maxTotalConcurrentConnections",
  "maxActiveConnectionsPerPod",
  "warmPoolEnabledDefault",
  "warmPoolMinPodsDefault",
] as const;

type CapacityKey = (typeof CAPACITY_KEYS)[number];

export type CompactRunnerModeCapacity = Partial<
  Record<CapacityKey, number | boolean>
>;

export type CompactProjectSubscriptionOutput = {
  project_id: string;
  subscription: {
    id: string;
    tier: string;
    status: string;
    billing_source?: string;
    capacity?: Record<string, CompactRunnerModeCapacity>;
  } | null;
};

type RunnerModeProfile = Partial<Record<CapacityKey, number | boolean>>;

type EntitlementRunnerProfiles = Partial<
  Record<string, RunnerModeProfile | undefined>
>;

type SubscriptionWithEntitlement = NonNullable<
  ProjectSubscriptionResponse["subscription"]
> & {
  billing_source?: string;
  entitlement_snapshot?: {
    runner?: EntitlementRunnerProfiles;
  } | null;
};

function pickCapacityFields(
  profile: RunnerModeProfile | undefined,
): CompactRunnerModeCapacity | undefined {
  if (!profile || typeof profile !== "object") {
    return undefined;
  }

  const picked: CompactRunnerModeCapacity = {};
  for (const key of CAPACITY_KEYS) {
    const value = profile[key];
    if (typeof value === "number" || typeof value === "boolean") {
      picked[key] = value;
    }
  }

  return Object.keys(picked).length > 0 ? picked : undefined;
}

function formatCapacity(
  runner: EntitlementRunnerProfiles | undefined,
): Record<string, CompactRunnerModeCapacity> | undefined {
  if (!runner || typeof runner !== "object") {
    return undefined;
  }

  const capacity: Record<string, CompactRunnerModeCapacity> = {};
  for (const [mode, profile] of Object.entries(runner)) {
    const picked = pickCapacityFields(profile);
    if (picked) {
      capacity[mode] = picked;
    }
  }

  return Object.keys(capacity).length > 0 ? capacity : undefined;
}

export function formatProjectSubscriptionOutput(
  result: ProjectSubscriptionResponse,
): CompactProjectSubscriptionOutput {
  const subscription =
    result.subscription as SubscriptionWithEntitlement | null;
  if (!subscription) {
    return {
      project_id: result.project_id,
      subscription: null,
    };
  }

  const compact: NonNullable<CompactProjectSubscriptionOutput["subscription"]> =
    {
      id: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
    };

  if (subscription.billing_source) {
    compact.billing_source = subscription.billing_source;
  }

  const capacity = formatCapacity(subscription.entitlement_snapshot?.runner);
  if (capacity) {
    compact.capacity = capacity;
  }

  return {
    project_id: result.project_id,
    subscription: compact,
  };
}
