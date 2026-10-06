/**
 * Keep in step with the platform (`platform/src/lib/voice/language-switch-wait-messages.ts`):
 * same default texts, 300 character limit and ISO 639-1 keys. The server validates the
 * languages and model ids; the CLI checks the shape so mistakes fail before the request.
 */
const WAIT_MESSAGE_MAX_CHARS = 300;
const DEFAULT_WAIT_MESSAGES_JSON = JSON.stringify({
  de: "Einen Moment bitte, ich wechsle gerade in Ihre Sprache.",
  en: "Please wait a moment while I switch to your language.",
  es: "Un momento, por favor, estoy cambiando a su idioma.",
  fr: "Un instant, s'il vous plaît, je passe dans votre langue.",
  it: "Un momento, per favore, sto passando alla sua lingua.",
  nl: "Een ogenblik, ik schakel over naar uw taal.",
  pl: "Chwileczkę, przełączam się na Twój język.",
  pt: "Um momento, por favor, estou mudando para o seu idioma.",
  ru: "Одну минуту, я перехожу на ваш язык.",
});

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
  "tts.phraseCache",
  "noiseSuppression.enabled",
  "languageId.enabled",
  "languageId.minSpeechMs",
  "languageId.timing",
  "languageId.autoSwitch.enabled",
  "languageId.autoSwitch.replayLastUtterance",
  "languageId.autoSwitch.finalHoldMs",
  "languageId.autoSwitch.minDwellMs",
  "languageId.autoSwitch.confirmUtterances",
  "languageId.autoSwitch.switchVoice",
  "languageId.autoSwitch.waitAudio",
  "languageId.autoSwitch.waitMessage.mode",
  "languageId.autoSwitch.waitMessage.skipWhenReady",
  "languageId.autoSwitch.waitMessage.texts",
  "languageId.autoSwitch.readyMessage.minSwitchMs",
  "languageId.autoSwitch.readyMessage.texts",
  "voice.allowedLanguages",
  "voice.profilesByLanguage",
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
    default: 0.9,
    min: 0.2,
    max: 2,
    description:
      "Piper speaking-rate multiplier for VoiceThere TTS (1.0 = model default).",
  },
  "tts.postUtteranceSilenceMs": {
    type: "number",
    default: 2550,
    min: 0,
    max: 15000,
    description:
      "Silent PCM after each TTS utterance so remote listeners can finalize STT.",
  },
  "tts.phraseCache": {
    type: "boolean",
    default: true,
    description:
      "Runner TTS phrase cache: repeated replies are served from memory on the runner instead of being synthesised again. On by default.",
  },
  "noiseSuppression.enabled": {
    type: "boolean",
    default: true,
    description:
      "Applies Xiph RNNoise to inbound PCM before VAD and STT on voice runners.",
  },
  "languageId.enabled": {
    type: "boolean",
    default: true,
    description:
      "Enable spoken language identification (VoiceThere Whisper tiny) on voice deploys.",
  },
  "languageId.minSpeechMs": {
    type: "number",
    default: 1500,
    min: 1000,
    max: 5000,
    description:
      "Minimum inbound PCM (ms) before first spoken-language identify per utterance (cloud default 1500). Shorter utterances skip language ID.",
  },
  "languageId.timing": {
    type: "string",
    default: "early",
    enum: ["early", "end_of_utterance", "continuous"],
    description:
      "When to identify the spoken language: early (once, as soon as minSpeechMs is buffered, while the caller talks), end_of_utterance (once, after the caller stops) or continuous (repeated passes; most CPU, turn off if agent audio gets choppy).",
  },
  "languageId.autoSwitch.enabled": {
    type: "boolean",
    default: false,
    description:
      "Auto-switch STT/TTS when LID disagrees with session language (default off; requires languageId.enabled). Requires VoiceThere (local-sherpa) for both speech-to-text and text-to-speech.",
  },
  "languageId.autoSwitch.replayLastUtterance": {
    type: "boolean",
    default: true,
    description: "Replay inbound PCM after STT swap when auto-switch is on.",
  },
  "languageId.autoSwitch.finalHoldMs": {
    type: "number",
    default: 5000,
    min: 0,
    max: 10_000,
    description:
      "Max ms to hold user_speech_final while waiting for user_language.",
  },
  "languageId.autoSwitch.minDwellMs": {
    type: "number",
    default: 10_000,
    min: 0,
    max: 60_000,
    description:
      "Ignore LID flips for this long after a committed auto-switch.",
  },
  "languageId.autoSwitch.confirmUtterances": {
    type: "number",
    default: 1,
    min: 1,
    max: 3,
    description:
      "Consecutive user_language events required before auto-switch.",
  },
  "languageId.autoSwitch.switchVoice": {
    type: "boolean",
    default: true,
    description: "Switch TTS as well as STT on auto-switch (false = STT only).",
  },
  "languageId.autoSwitch.waitAudio": {
    type: "string",
    default: "buffer_replay",
    enum: ["buffer_replay", "first_utterance"],
    description:
      "Speech kept while the new language loads: buffer_replay replays everything said during the wait, first_utterance replays only the utterance that triggered language ID.",
  },
  "languageId.autoSwitch.waitMessage.mode": {
    type: "string",
    default: "end_of_utterance",
    enum: ["end_of_utterance", "immediate", "off"],
    description:
      "Whether the switch may interrupt the caller: end_of_utterance (default) waits until the caller stops, immediate speaks at once and cannot be interrupted, off plays no wait message.",
  },
  "languageId.autoSwitch.waitMessage.skipWhenReady": {
    type: "boolean",
    default: true,
    description:
      "Skip the wait message when the target language is already running.",
  },
  "languageId.autoSwitch.waitMessage.texts": {
    type: "string",
    default: DEFAULT_WAIT_MESSAGES_JSON,
    description:
      'JSON map of ISO 639-1 code to wait text (max 300 chars each), spoken in the language being left, e.g. {"en":"One moment, switching to your language."}.',
  },
  "languageId.autoSwitch.readyMessage.minSwitchMs": {
    type: "number",
    default: 2000,
    min: 0,
    max: 15_000,
    description:
      "Play a short 'Okay, let's continue in <language>.' in the new voice when a language switch took at least this long and no wait message was played. 0 turns it off.",
  },
  "languageId.autoSwitch.readyMessage.texts": {
    type: "string",
    default: "{}",
    description:
      'Per-language ready message text, e.g. {"de":"Okay, machen wir auf Deutsch weiter."}. Unset languages use the built-in text.',
  },
  "voice.allowedLanguages": {
    type: "string",
    default: "",
    description:
      "Allowed languages for setVoiceLanguage / LID auto-switch (* = any for agent API). Empty = boot language plus the languages in voice.profilesByLanguage.",
  },
  "voice.profilesByLanguage": {
    type: "string",
    default: "{}",
    description:
      'STT/TTS model per language used after a switch, as JSON, e.g. {"de":{"stt":"de","tts":"de-thorsten-high"}}.',
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
  lines.push("  $ voicethere projects voice-advanced set tts.speed 0.9");
  lines.push(
    '  $ voicethere projects voice-advanced set voice.profilesByLanguage \'{"de":{"stt":"de","tts":"de-thorsten-high"}}\'',
  );
  lines.push(
    "  $ voicethere projects voice-advanced set languageId.autoSwitch.enabled true",
  );
  lines.push(
    "  $ voicethere projects voice-advanced set languageId.autoSwitch.waitMessage.mode immediate",
  );
  lines.push(
    '  $ voicethere projects voice-advanced set languageId.autoSwitch.waitMessage.texts \'{"en":"One moment, switching to your language."}\'',
  );
  lines.push("  $ voicethere projects voice-advanced reset");

  return lines.join("\n");
}

const ISO_LANG_RE = /^[a-z]{2}$/;

function parseJsonObject(key: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${key} must be a valid JSON object`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${key} must be a JSON object keyed by language code`);
  }
  return parsed as Record<string, unknown>;
}

function validateWaitMessageTexts(
  raw: string,
  key = "languageId.autoSwitch.waitMessage.texts",
): string {
  const obj = parseJsonObject(key, raw || "{}");
  for (const [lang, text] of Object.entries(obj)) {
    if (!ISO_LANG_RE.test(lang)) {
      throw new Error(
        `${key}: invalid language key "${lang}" (use ISO 639-1, e.g. en)`,
      );
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`${key}.${lang} must be a non-empty string`);
    }
    if ([...text.trim()].length > WAIT_MESSAGE_MAX_CHARS) {
      throw new Error(
        `${key}.${lang} must be at most ${WAIT_MESSAGE_MAX_CHARS} characters`,
      );
    }
  }
  return raw || "{}";
}

function validateProfilesByLanguage(raw: string): string {
  const key = "voice.profilesByLanguage";
  const obj = parseJsonObject(key, raw || "{}");
  for (const [lang, entry] of Object.entries(obj)) {
    if (!ISO_LANG_RE.test(lang)) {
      throw new Error(
        `${key}: invalid language key "${lang}" (use ISO 639-1, e.g. en)`,
      );
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${key}.${lang} must be an object`);
    }
    const row = entry as Record<string, unknown>;
    for (const field of ["stt", "tts", "voice", "sttVendor", "ttsVendor"]) {
      if (row[field] !== undefined && typeof row[field] !== "string") {
        throw new Error(`${key}.${lang}.${field} must be a string`);
      }
    }
    if (Object.keys(row).length === 0) {
      throw new Error(`${key}.${lang} is empty`);
    }
  }
  return raw || "{}";
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
    if (key === "languageId.autoSwitch.waitMessage.texts") {
      return validateWaitMessageTexts(trimmed);
    }
    if (key === "languageId.autoSwitch.readyMessage.texts") {
      return validateWaitMessageTexts(trimmed, key);
    }
    if (key === "voice.profilesByLanguage") {
      return validateProfilesByLanguage(trimmed);
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

/**
 * The API returns the wait message settings flat under `languageId.autoSwitch`
 * (`waitMessageMode`, `readyMessageMinSwitchMs`), while the setting keys use dotted `waitMessage.` / `readyMessage.` prefixes.
 */
const RESOLVED_PATH_OVERRIDES: Partial<
  Record<VoiceAdvancedSettingKey, string[]>
> = {
  "languageId.autoSwitch.waitMessage.mode": [
    "languageId",
    "autoSwitch",
    "waitMessageMode",
  ],
  "languageId.autoSwitch.waitMessage.skipWhenReady": [
    "languageId",
    "autoSwitch",
    "waitMessageSkipWhenReady",
  ],
  "languageId.autoSwitch.waitMessage.texts": [
    "languageId",
    "autoSwitch",
    "waitMessageTexts",
  ],
  "languageId.autoSwitch.readyMessage.minSwitchMs": [
    "languageId",
    "autoSwitch",
    "readyMessageMinSwitchMs",
  ],
  "languageId.autoSwitch.readyMessage.texts": [
    "languageId",
    "autoSwitch",
    "readyMessageTexts",
  ],
};

function getNestedValue(
  settings: Record<string, unknown>,
  key: VoiceAdvancedSettingKey,
): unknown {
  const parts = RESOLVED_PATH_OVERRIDES[key] ?? key.split(".");
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
