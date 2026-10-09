import type { VoiceLatencyBlock } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  VOICE_METRICS_PERIODS,
  describeWindow,
  formatNumber,
  resolveMetricsRange,
  type MetricsRangeOptions,
} from "./range.js";

export interface ProjectsMetricsVoiceOptions extends MetricsRangeOptions {
  projectId?: string;
  json?: boolean;
}

const BLOCKS: Array<[label: string, key: BlockKey]> = [
  ["STT", "stt"],
  ["TTS", "tts"],
  ["Turn response (speech end to first audio)", "turn_response"],
  ["Final to audio (STT final to first audio)", "final_to_audio"],
  ["Finalize delay (speech end to STT final)", "finalize_delay"],
  ["TTS first audio", "tts_first_audio"],
];

type BlockKey =
  | "stt"
  | "tts"
  | "turn_response"
  | "final_to_audio"
  | "finalize_delay"
  | "tts_first_audio";

function line(label: string, block: VoiceLatencyBlock): string {
  return `  ${label}: p50 ${formatNumber(block.p50_ms)} ms, p95 ${formatNumber(block.p95_ms)} ms, p99 ${formatNumber(block.p99_ms)} ms`;
}

export async function runProjectsMetricsVoice(
  options: ProjectsMetricsVoiceOptions = {},
): Promise<void> {
  const range = resolveMetricsRange(options, VOICE_METRICS_PERIODS);
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Reading voice metrics for project ${projectId}`);
  const api = createApiFromCredentials(await requireCredentials());
  const metrics = await api.getProjectVoiceMetrics(projectId, range);

  if (options.json) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log(`Voice metrics (${describeWindow(metrics)})`);
  if (metrics.range_too_long) {
    console.log("  Voice metrics are kept for 14 days. Pick a shorter range.");
    return;
  }
  if (!metrics.available) {
    console.log("  Voice metrics are not available for this project.");
    return;
  }
  for (const [label, key] of BLOCKS) {
    console.log(line(label, metrics[key]));
  }
}
