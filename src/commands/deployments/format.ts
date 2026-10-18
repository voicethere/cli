import type {
  DeploymentEvent,
  DeploymentFailureClass,
  DeploymentRequestedBy,
  DeploymentSummary,
} from "../../lib/api.js";
import {
  deploymentBlockedCodeText,
  deploymentEventLabel,
  isRefusedFailure,
} from "../../lib/deployment-labels.js";

/** `YYYY-MM-DD HH:MM:SS` in UTC. */
export function formatUtcDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

/** `HH:MM:SS` in UTC. */
export function formatUtcTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19);
}

/** `m:ss`; minutes are not capped, so 75 minutes reads `75:00`. */
export function formatMinSec(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function elapsedMs(fromIso: string, toIso: string): number {
  return Date.parse(toIso) - Date.parse(fromIso);
}

function shortBuild(buildId: string | null | undefined): string {
  return buildId ? buildId.slice(0, 8) : "-";
}

export function requestedByText(
  requestedBy: DeploymentRequestedBy | undefined,
): string {
  return requestedBy?.label ?? "-";
}

function padEnd(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/** Aligned table; the last column is not padded. */
function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, index) =>
        index === cells.length - 1 ? cell : padEnd(cell, widths[index] ?? 0),
      )
      .join("  ")
      .trimEnd();
  return [line(headers), ...rows.map(line)];
}

export function formatDeploymentList(
  deployments: DeploymentSummary[],
  nextBefore: string | null,
): string[] {
  if (deployments.length === 0) {
    return ["No deployments yet."];
  }
  const rows = deployments.map((deployment) => [
    formatUtcDateTime(deployment.created_at),
    shortBuild(deployment.build_id),
    deployment.mode,
    deployment.status,
    requestedByText(deployment.requested_by),
    deployment.completed_at
      ? formatMinSec(elapsedMs(deployment.created_at, deployment.completed_at))
      : "-",
    deployment.last_event_at ? formatUtcDateTime(deployment.last_event_at) : "-",
  ]);
  const lines = renderTable(
    [
      "Started (UTC)",
      "Build",
      "Mode",
      "Status",
      "By",
      "Duration",
      "Last event (UTC)",
    ],
    rows,
  );
  if (nextBefore) {
    lines.push(`next: --before ${nextBefore}`);
  }
  return lines;
}

const FAILURE_CLASS_LABEL: Record<DeploymentFailureClass, string> = {
  customer: "fix needed in your agent",
  platform: "on our side",
  transient: "retrying",
};

function countChip(name: string, value: unknown): string | undefined {
  return typeof value === "number" ? `${name}=${value}` : undefined;
}

/** Customer-safe chips for the details of one event. Unknown keys stay in `--json`. */
export function eventDetailChips(
  event: DeploymentEvent,
  deploymentHasFailure = false,
): string[] {
  const details = event.details ?? {};
  const chips: (string | undefined)[] = [];

  if (typeof details.mode === "string") {
    chips.push(`mode=${details.mode}`);
  }
  if (typeof details.code === "string") {
    chips.push(deploymentBlockedCodeText(details.code) ?? details.code);
  }
  chips.push(countChip("runners", details.ready_pods));
  chips.push(countChip("runners", details.pods));
  chips.push(countChip("runners retiring", details.retiring_pods));
  chips.push(countChip("runners ended", details.forced_pods));
  chips.push(countChip("versions", details.releases));
  chips.push(countChip("versions", details.from_releases));
  if (typeof details.drain_duration_ms === "number") {
    chips.push(`drained in ${formatMinSec(details.drain_duration_ms)}`);
  }
  const failureShownAbove = event.type === "failed" && deploymentHasFailure;
  if (
    typeof details.error === "string" &&
    details.error.length > 0 &&
    !failureShownAbove
  ) {
    chips.push(`error: ${details.error}`);
  }
  return chips.filter((chip): chip is string => chip !== undefined);
}

export function formatDeploymentTimeline(
  deployment: DeploymentSummary,
  events: DeploymentEvent[],
  derived: boolean,
): string[] {
  const lines = [
    [
      deployment.id,
      `build ${shortBuild(deployment.build_id)}`,
      deployment.mode,
      deployment.status,
      `started ${formatUtcDateTime(deployment.created_at)} UTC`,
    ].join("  "),
  ];
  if (deployment.requested_by) {
    lines.push(`Requested by: ${requestedByText(deployment.requested_by)}`);
  }
  if (deployment.failure) {
    const { class: failureClass, code, message } = deployment.failure;
    const label = isRefusedFailure(deployment.failure)
      ? "refused"
      : (FAILURE_CLASS_LABEL[failureClass] ?? failureClass);
    lines.push(`Failure: ${label} ${code}: ${message}`);
  }
  const labelWidth = Math.max(
    0,
    ...events.map((event) => deploymentEventLabel(event.type).length),
  );
  for (const event of events) {
    const chips = eventDetailChips(event, Boolean(deployment.failure));
    const label = deploymentEventLabel(event.type);
    const parts = [
      `${formatUtcTime(event.occurred_at)} UTC`,
      `+${formatMinSec(elapsedMs(deployment.created_at, event.occurred_at))}`,
      chips.length > 0 ? padEnd(label, labelWidth) : label,
    ];
    if (chips.length > 0) {
      parts.push(chips.join("  "));
    }
    lines.push(parts.join("  "));
  }
  if (derived) {
    lines.push("(start and end only)");
  }
  return lines;
}
