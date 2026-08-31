import {
  type ProjectWidgetConfigResponse,
  type VoiceThereWidgetConfigV1,
  createApi,
} from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { pollWithBackoff } from "../../../lib/poll-backoff.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  buildWidgetConfigUrls,
  resolveWidgetCdnBase,
} from "../../../lib/widget-cdn.js";

export const WIDGET_PRESETS = [
  "pill-dark",
  "pill-light",
  "rounded-card",
  "minimal-bar",
  "voice-orb",
] as const;

export const WIDGET_POSITIONS = ["bottom-right", "bottom-left"] as const;

export const WIDGET_MODES = ["chat", "voice"] as const;

export type WidgetPreset = (typeof WIDGET_PRESETS)[number];
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];
export type WidgetMode = (typeof WIDGET_MODES)[number];

const WIDGET_TERMINAL_PUBLISH_STATUSES = new Set(["published", "failed"]);

export function validateWidgetPreset(value: string): WidgetPreset {
  if ((WIDGET_PRESETS as readonly string[]).includes(value)) {
    return value as WidgetPreset;
  }
  throw new Error(
    `Unknown widget preset "${value}". Expected one of: ${WIDGET_PRESETS.join(", ")}`,
  );
}

export function validateWidgetPosition(value: string): WidgetPosition {
  if ((WIDGET_POSITIONS as readonly string[]).includes(value)) {
    return value as WidgetPosition;
  }
  throw new Error(
    `Unknown widget position "${value}". Expected one of: ${WIDGET_POSITIONS.join(", ")}`,
  );
}

export function validateWidgetMode(value: string): WidgetMode {
  if ((WIDGET_MODES as readonly string[]).includes(value)) {
    return value as WidgetMode;
  }
  throw new Error(
    `Unknown widget mode "${value}". Expected one of: ${WIDGET_MODES.join(", ")}`,
  );
}

export function validateWidgetHexColor(value: string, label: string): string {
  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) {
    throw new Error(
      `${label} must be a hex color (#RGB or #RRGGBB), got: ${value}`,
    );
  }
  return value;
}

function resolveCdnBase(apiBase: string, cdnBaseOverride?: string): string {
  return resolveWidgetCdnBase({
    apiBase,
    cliOverride: cdnBaseOverride,
  });
}

function printWidgetCdnUrls(
  cdnBase: string,
  publicId: string,
  revision?: number,
): void {
  const urls = buildWidgetConfigUrls(cdnBase, publicId, revision);
  console.log(`  cdn_url: ${urls.stable}`);
  if (urls.immutable) {
    console.log(`  cdn_url_immutable: ${urls.immutable}`);
  }
}

function printDraftSummary(draft: VoiceThereWidgetConfigV1): void {
  console.log(
    `  draft: preset=${draft.preset ?? "pill-dark"} position=${draft.position ?? "bottom-right"} mode=${draft.mode ?? "voice"}`,
  );
  if (draft.launcherLabel) {
    console.log(`  launcher_label: ${draft.launcherLabel}`);
  }
  if (draft.greeting) {
    console.log(`  greeting: ${draft.greeting}`);
  }
}

export interface ProjectsWidgetShowOptions {
  projectId?: string;
  cdnBase?: string;
  json?: boolean;
}

export async function runProjectsWidgetShow(
  options: ProjectsWidgetShowOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Loading embed widget config for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const result = await api.getProjectWidget(projectId);
  logVerbose(`widget publish_status=${result.publish_status}`);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const cdnBase = resolveCdnBase(credentials.api_base, options.cdnBase);
  console.log(`public_id: ${result.public_id}`);
  console.log(`publish_status: ${result.publish_status}`);
  console.log(`published_revision: ${result.published_revision}`);
  printWidgetCdnUrls(cdnBase, result.public_id, result.published_revision);
  printDraftSummary(result.draft);
  if (result.publish_error) {
    console.log(`publish_error: ${result.publish_error}`);
  }
}

export interface ProjectsWidgetSetOptions {
  projectId?: string;
  preset?: string;
  position?: string;
  mode?: string;
  launcherLabel?: string;
  greeting?: string;
  themePrimary?: string;
  themeBackground?: string;
  themeText?: string;
  json?: boolean;
}

function hasWidgetSetFlags(options: ProjectsWidgetSetOptions): boolean {
  return (
    options.preset !== undefined ||
    options.position !== undefined ||
    options.mode !== undefined ||
    options.launcherLabel !== undefined ||
    options.greeting !== undefined ||
    options.themePrimary !== undefined ||
    options.themeBackground !== undefined ||
    options.themeText !== undefined
  );
}

function mergeWidgetDraft(
  current: VoiceThereWidgetConfigV1,
  options: ProjectsWidgetSetOptions,
): VoiceThereWidgetConfigV1 {
  const draft: VoiceThereWidgetConfigV1 = {
    ...current,
    v: 1,
  };

  if (options.preset !== undefined) {
    draft.preset = validateWidgetPreset(options.preset);
  }
  if (options.position !== undefined) {
    draft.position = validateWidgetPosition(options.position);
  }
  if (options.mode !== undefined) {
    draft.mode = validateWidgetMode(options.mode);
  }
  if (options.launcherLabel !== undefined) {
    draft.launcherLabel = options.launcherLabel;
  }
  if (options.greeting !== undefined) {
    draft.greeting = options.greeting;
  }

  if (options.themePrimary !== undefined) {
    draft.theme = {
      ...draft.theme,
      primary: validateWidgetHexColor(options.themePrimary, "--theme-primary"),
    };
  }
  if (options.themeBackground !== undefined) {
    draft.theme = {
      ...draft.theme,
      background: validateWidgetHexColor(
        options.themeBackground,
        "--theme-background",
      ),
    };
  }
  if (options.themeText !== undefined) {
    draft.theme = {
      ...draft.theme,
      text: validateWidgetHexColor(options.themeText, "--theme-text"),
    };
  }

  return draft;
}

export async function runProjectsWidgetSet(
  options: ProjectsWidgetSetOptions = {},
): Promise<void> {
  if (!hasWidgetSetFlags(options)) {
    throw new Error(
      "Specify at least one widget field to update (e.g. --preset, --position, --mode, --launcher-label, --greeting, or --theme-*)",
    );
  }

  if (options.preset !== undefined) {
    validateWidgetPreset(options.preset);
  }
  if (options.position !== undefined) {
    validateWidgetPosition(options.position);
  }
  if (options.mode !== undefined) {
    validateWidgetMode(options.mode);
  }
  if (options.themePrimary !== undefined) {
    validateWidgetHexColor(options.themePrimary, "--theme-primary");
  }
  if (options.themeBackground !== undefined) {
    validateWidgetHexColor(options.themeBackground, "--theme-background");
  }
  if (options.themeText !== undefined) {
    validateWidgetHexColor(options.themeText, "--theme-text");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Updating embed widget draft for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const current = await api.getProjectWidget(projectId);
  const draft = mergeWidgetDraft(current.draft, options);
  const result = await api.updateProjectWidgetDraft(projectId, draft);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`public_id: ${result.public_id}`);
  console.log(`publish_status: ${result.publish_status}`);
  printDraftSummary(result.draft);
}

export interface ProjectsWidgetDeployOptions {
  projectId?: string;
  wait?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  cdnBase?: string;
  json?: boolean;
}

async function pollWidgetPublish(
  api: ReturnType<typeof createApi>,
  projectId: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<ProjectWidgetConfigResponse> {
  return pollWithBackoff({
    poll: () => api.getProjectWidget(projectId),
    isTerminal: (widget) =>
      WIDGET_TERMINAL_PUBLISH_STATUSES.has(widget.publish_status),
    getProgress: (widget) => ({
      status: widget.publish_status,
      progressId:
        widget.published_revision > 0
          ? String(widget.published_revision)
          : null,
    }),
    onPoll: (widget) =>
      logVerbose(
        `widget publish: status=${widget.publish_status} revision=${widget.published_revision}`,
      ),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for widget publish`,
  });
}

export async function runProjectsWidgetDeploy(
  options: ProjectsWidgetDeployOptions = {},
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Publishing embed widget for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const cdnBase = resolveCdnBase(credentials.api_base, options.cdnBase);

  let result = await api.publishProjectWidget(projectId);

  if (!options.wait) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`public_id: ${result.public_id}`);
    console.log(`publish_status: ${result.publish_status}`);
    printWidgetCdnUrls(cdnBase, result.public_id, result.published_revision);
    console.log(
      "Poll with: voicethere projects widget show  (or: voicethere projects widget deploy --wait)",
    );
    return;
  }

  logStep("Waiting for widget publish to complete");
  result = await pollWidgetPublish(api, projectId, {
    pollIntervalMs: options.pollIntervalMs ?? 2_000,
    timeoutMs: options.timeoutMs ?? 90_000,
  });

  if (result.publish_status === "failed") {
    throw new Error(result.publish_error ?? "Widget publish failed");
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`public_id: ${result.public_id}`);
  console.log(`publish_status: ${result.publish_status}`);
  console.log(`published_revision: ${result.published_revision}`);
  printWidgetCdnUrls(cdnBase, result.public_id, result.published_revision);
}
