import type { CanaryView, PatchCanaryInput } from "../../lib/api.js";
import {
  buildCanarySettings,
  parseCanaryPods,
  parseMinSessions,
  parseRatePct,
} from "../../lib/canary-options.js";
import { logStep } from "../../lib/command-log.js";
import { requireCredentials } from "../../lib/config.js";
import { createApiFromCredentials } from "../../lib/control-plane-auth.js";
import { requireProjectId } from "../../lib/project-config.js";
import { isInteractive, promptYesNo } from "../../lib/prompt.js";

interface ProjectOption {
  projectId?: string;
}

async function connect(options: ProjectOption) {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const api = createApiFromCredentials(await requireCredentials());
  return { projectId, api };
}

export function formatCanaryView(canary: CanaryView): string[] {
  const routing =
    canary.routing_mode === "customer_context"
      ? `customer-context (field: ${canary.routing_context_field ?? "-"})`
      : "round-robin";
  const autoAbort = canary.auto_abort_enabled
    ? `on (abort above ${canary.max_failure_rate_pct}% failures, after ${canary.min_sessions} sessions)`
    : `off (rate ${canary.max_failure_rate_pct}%, min sessions ${canary.min_sessions})`;
  const lines = [
    `Canary status: ${canary.status}`,
    `  stable build:   ${canary.stable_build_id}`,
    `  canary build:   ${canary.canary_build_id}`,
    `  canary pods:    ${canary.canary_pods} of ${canary.plan_max_pods}`,
    `  traffic share:  ${canary.traffic_share_pct}%`,
    `  routing:        ${routing}`,
    `  auto-abort:     ${autoAbort}`,
    `  started at:     ${canary.started_at}`,
  ];
  if (canary.ended_at) {
    lines.push(`  ended at:       ${canary.ended_at}`);
  }
  if (canary.end_reason) {
    lines.push(`  end reason:     ${canary.end_reason}`);
  }
  return lines;
}

export interface CanaryStatusOptions extends ProjectOption {
  json?: boolean;
}

export async function runCanaryStatus(
  options: CanaryStatusOptions = {},
): Promise<void> {
  const { projectId, api } = await connect(options);
  logStep(`Reading canary for project ${projectId}`);
  const result = await api.getCanary(projectId);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.canary) {
    console.log("No canary deployment.");
    console.log(`  plan max pods: ${result.plan_max_pods}`);
    return;
  }
  for (const line of formatCanaryView(result.canary)) {
    console.log(line);
  }
}

export interface CanarySetOptions extends ProjectOption {
  pods?: string;
  routing?: string;
  contextField?: string;
}

export async function runCanarySet(options: CanarySetOptions): Promise<void> {
  const body: PatchCanaryInput = {
    ...(options.pods !== undefined
      ? { canary_pods: parseCanaryPods(options.pods) }
      : {}),
    ...buildCanarySettings({
      routing: options.routing,
      contextField: options.contextField,
    }),
  };
  if (Object.keys(body).length === 0) {
    throw new Error("Provide --pods or --routing to change.");
  }
  const { projectId, api } = await connect(options);
  logStep("Updating canary");
  const { canary } = await api.patchCanary(projectId, body);
  for (const line of formatCanaryView(canary)) {
    console.log(line);
  }
}

export interface CanaryAutoAbortOptions extends ProjectOption {
  rate?: string;
  minSessions?: string;
  off?: boolean;
}

export async function runCanaryAutoAbort(
  options: CanaryAutoAbortOptions,
): Promise<void> {
  let body: PatchCanaryInput;
  if (options.off) {
    if (options.rate !== undefined || options.minSessions !== undefined) {
      throw new Error("--off cannot be combined with --rate or --min-sessions");
    }
    body = { auto_abort_enabled: false };
  } else {
    if (options.rate === undefined || options.minSessions === undefined) {
      throw new Error("Pass --rate and --min-sessions, or --off.");
    }
    body = {
      auto_abort_enabled: true,
      max_failure_rate_pct: parseRatePct("--rate", options.rate),
      min_sessions: parseMinSessions("--min-sessions", options.minSessions),
    };
  }
  const { projectId, api } = await connect(options);
  logStep("Updating canary auto-abort");
  const { canary } = await api.patchCanary(projectId, body);
  for (const line of formatCanaryView(canary)) {
    console.log(line);
  }
}

export interface CanaryActionOptions extends ProjectOption {
  yes?: boolean;
}

async function confirm(
  options: CanaryActionOptions,
  question: string,
  verb: string,
) {
  if (options.yes) return;
  if (!isInteractive()) {
    throw new Error(
      `Refusing to ${verb} without confirmation. Re-run in a TTY or pass --yes.`,
    );
  }
  if (!(await promptYesNo(question))) {
    throw new Error("Cancelled.");
  }
}

export async function runCanaryPromote(
  options: CanaryActionOptions = {},
): Promise<void> {
  await confirm(
    options,
    "Promote the canary? All new sessions move to the canary build.",
    "promote the canary",
  );
  const { projectId, api } = await connect(options);
  logStep("Promoting canary");
  const result = await api.promoteCanary(projectId);
  console.log(
    result.already_done
      ? "Canary was already promoted."
      : "Canary promoted. New sessions run on the canary build.",
  );
  console.log(`  stable build: ${result.canary.canary_build_id}`);
}

export async function runCanaryAbort(
  options: CanaryActionOptions = {},
): Promise<void> {
  await confirm(
    options,
    "Abort the canary? New sessions go back to the stable build; calls in progress finish.",
    "abort the canary",
  );
  const { projectId, api } = await connect(options);
  logStep("Aborting canary");
  const result = await api.abortCanary(projectId);
  console.log(
    result.already_done
      ? "Canary was already aborted."
      : "Canary aborted. New sessions run on the stable build.",
  );
  console.log(`  stable build: ${result.canary.stable_build_id}`);
}
