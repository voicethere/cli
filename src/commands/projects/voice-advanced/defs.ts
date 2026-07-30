export const VOICE_ADVANCED_SETTING_KEYS = [
  "vad.enabled",
  "vad.provider",
  "vad.threshold",
  "vad.minSpeechDurationMs",
  "vad.minSilenceDurationMs",
  "vad.speechPadMs",
  "vad.sampleRate",
  "vad.gateStt",
  "vad.gateSttOpenOnPending",
  "vad.sttGateHoldMs",
  "vad.sttListenTimeoutMs",
  "vad.utteranceFinalizeTimeoutMs",
  "vad.bargeIn.enabled",
  "vad.bargeIn.useVad",
  "vad.bargeIn.flushTts",
  "vad.bargeIn.requireSttPartial",
  "vad.bargeIn.minSttPartialChars",
  "vad.bargeIn.agentPlaybackGuardMs",
  "tts.speed",
  "tts.postUtteranceSilenceMs",
  "events.mode",
] as const;

export type VoiceAdvancedSettingKey =
  (typeof VOICE_ADVANCED_SETTING_KEYS)[number];

export const VOICE_ADVANCED_SETTING_DEFS: Record<
  VoiceAdvancedSettingKey,
  {
    type: "boolean" | "number" | "string";
    default: boolean | number | string;
    min?: number;
    max?: number;
    enum?: readonly string[];
    description: string;
  }
> = {
  "vad.enabled": {
    type: "boolean",
    default: true,
    description: "Master switch for voice activity detection.",
  },
  "vad.provider": {
    type: "string",
    default: "energy",
    enum: ["energy", "silero"],
    description: "VAD provider (energy or silero).",
  },
  "vad.threshold": {
    type: "number",
    default: 0.15,
    min: 0.001,
    max: 1,
    description: "VAD sensitivity threshold.",
  },
  "vad.minSpeechDurationMs": {
    type: "number",
    default: 250,
    min: 50,
    max: 5000,
    description: "Minimum voiced duration before speech start.",
  },
  "vad.minSilenceDurationMs": {
    type: "number",
    default: 1300,
    min: 100,
    max: 10000,
    description: "Silence duration before speech end.",
  },
  "vad.speechPadMs": {
    type: "number",
    default: 1000,
    min: 0,
    max: 3000,
    description: "STT pre-roll pad in milliseconds.",
  },
  "vad.sampleRate": {
    type: "string",
    default: "16000",
    enum: ["8000", "16000"],
    description: "Internal VAD sample rate.",
  },
  "vad.gateStt": {
    type: "boolean",
    default: true,
    description: "Gate STT to open windows only.",
  },
  "vad.gateSttOpenOnPending": {
    type: "boolean",
    default: true,
    description: "Feed STT during VAD pending speech.",
  },
  "vad.sttGateHoldMs": {
    type: "number",
    default: 1000,
    min: 0,
    max: 10000,
    description: "Keep STT open after speech end.",
  },
  "vad.sttListenTimeoutMs": {
    type: "number",
    default: 4000,
    min: 500,
    max: 30000,
    description: "Timeout when no STT partial after VAD trigger.",
  },
  "vad.utteranceFinalizeTimeoutMs": {
    type: "number",
    default: 1500,
    min: 200,
    max: 10000,
    description: "Grace before forcing user_speech_final.",
  },
  "vad.bargeIn.enabled": {
    type: "boolean",
    default: true,
    description: "Enable barge-in (stop agent TTS on interrupt).",
  },
  "vad.bargeIn.useVad": {
    type: "boolean",
    default: true,
    description: "Use VAD to trigger barge-in automatically.",
  },
  "vad.bargeIn.flushTts": {
    type: "boolean",
    default: true,
    description: "Clear pending TTS on barge-in.",
  },
  "vad.bargeIn.requireSttPartial": {
    type: "boolean",
    default: true,
    description: "Require STT partial before barge-in during agent TTS.",
  },
  "vad.bargeIn.minSttPartialChars": {
    type: "number",
    default: 2,
    min: 1,
    max: 32,
    description: "Minimum partial length for semantic barge-in.",
  },
  "vad.bargeIn.agentPlaybackGuardMs": {
    type: "number",
    default: 0,
    min: 0,
    max: 5000,
    description: "Ignore VAD barge-in briefly after TTS starts.",
  },
  "tts.speed": {
    type: "number",
    default: 0.6,
    min: 0.2,
    max: 2,
    description:
      "Sherpa Piper speaking-rate multiplier for local-sherpa TTS (1.0 = model default).",
  },
  "tts.postUtteranceSilenceMs": {
    type: "number",
    default: 2550,
    min: 0,
    max: 15000,
    description:
      "Silent PCM after each TTS utterance so remote listeners can finalize STT.",
  },
  "events.mode": {
    type: "string",
    default: "both",
    enum: ["callback", "stream", "both"],
    description: "Speech event delivery mode.",
  },
};

const SETTING_NAMES_HELP = VOICE_ADVANCED_SETTING_KEYS.join(" | ");

export function voiceAdvancedSettingNamesHelp(): string {
  return SETTING_NAMES_HELP;
}

export function formatVoiceAdvancedSettingsGroupHelp(): string {
  const lines = [
    "",
    "Advanced voice pipeline settings apply on the next deploy.",
    "Boolean values: true|false|1|0|yes|no.",
    "",
    "Keys (default in parentheses):",
  ];

  for (const key of VOICE_ADVANCED_SETTING_KEYS) {
    const def = VOICE_ADVANCED_SETTING_DEFS[key];
    const range =
      def.type === "number" && def.min !== undefined && def.max !== undefined
        ? ` [${def.min}–${def.max}]`
        : "";
    lines.push(`  ${key} (${String(def.default)})${range}`);
    lines.push(`    ${def.description}`);
  }

  lines.push("");
  lines.push("Examples:");
  lines.push("  $ voicethere projects voice-advanced list");
  lines.push(
    "  $ voicethere projects voice-advanced set vad.bargeIn.requireSttPartial false",
  );
  lines.push("  $ voicethere projects voice-advanced set tts.speed 0.6");
  lines.push("  $ voicethere projects voice-advanced reset");

  return lines.join("\n");
}

export function parseVoiceAdvancedSettingValue(
  key: VoiceAdvancedSettingKey,
  raw: string,
): boolean | number | string {
  const def = VOICE_ADVANCED_SETTING_DEFS[key];

  if (def.type === "string") {
    const trimmed = raw.trim();
    if (def.enum && !def.enum.includes(trimmed)) {
      throw new Error(`${key} must be one of: ${def.enum.join(", ")}`);
    }
    return trimmed;
  }

  if (def.type === "boolean") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    throw new Error(`Invalid boolean for ${key}: use true or false`);
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${key}`);
  }
  const min = def.min ?? 0;
  const max = def.max ?? Number.MAX_SAFE_INTEGER;
  if (n < min || n > max) {
    throw new Error(`${key} must be between ${min} and ${max}`);
  }
  const keepFractional = key === "vad.threshold" || key === "tts.speed";
  return def.type === "number" && keepFractional ? n : Math.floor(n);
}

function getNestedValue(
  settings: Record<string, unknown>,
  key: VoiceAdvancedSettingKey,
): unknown {
  const parts = key.split(".");
  let current: unknown = settings;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function formatVoiceAdvancedSettingLine(
  settings: Record<string, unknown>,
  key: VoiceAdvancedSettingKey,
): string | null {
  const value = getNestedValue(settings, key);
  if (value === undefined) {
    return null;
  }
  return `${key}=${String(value)}`;
}
