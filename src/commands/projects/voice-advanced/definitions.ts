import {
  VOICE_AGENT_SETTING_PATHS,
  VOICE_AGENT_SETTINGS,
  type VoiceAgentSettingDef,
} from "@node-webrtc-rust/voice-catalog";
import type {
  ProjectVoiceAdvancedSettingsResponse,
  VoiceAdvancedDefinition,
} from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";

/**
 * A setting as the CLI checks it. Engine facts (type, integer, enum, engine range) come from the
 * voice engine catalog; the API `definitions` add the product cap, label and description. The
 * server stays the final validator.
 */
export interface ResolvedDef {
  key: string;
  /** Where the response's `settings` / `defaults` hold the value. */
  path: string[];
  type: "boolean" | "number" | "string";
  default?: unknown;
  integer?: boolean;
  /** Values the engine accepts. */
  engineEnum?: readonly string[];
  /** Values the API accepts (a product subset of the engine values). */
  apiEnum?: readonly string[];
  engineMin?: number;
  engineMax?: number;
  /** Product cap from the API, applied after the engine range. */
  capMin?: number;
  capMax?: number;
  label?: string;
  description?: string;
}

/**
 * Response-shape mapping for platforms without `definitions`: the response holds these five wait
 * message settings flat under `languageId.autoSwitch`, while the keys use dotted prefixes.
 */
const FLAT_RESPONSE_PATHS: Record<string, string[]> = {
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

const U32_MAX = 4294967295;

function catalogDef(path: string | null): VoiceAgentSettingDef | undefined {
  if (!path || !Object.hasOwn(VOICE_AGENT_SETTINGS, path)) {
    return undefined;
  }
  return (VOICE_AGENT_SETTINGS as Record<string, VoiceAgentSettingDef>)[path];
}

function warnDisagreement(key: string, what: string): void {
  logStep(
    `warning: ${key}: the API ${what} differs from the voice engine catalog; using the catalog`,
  );
}

function fromApiDefinition(api: VoiceAdvancedDefinition): ResolvedDef {
  const engine = catalogDef(api.engineKey);
  const base: ResolvedDef = {
    key: api.key,
    path: api.path,
    type: api.type,
    default: api.default,
    label: api.label,
    description: api.description,
  };
  if (!engine) {
    // A VoiceThere-only key: the API is the only source.
    return {
      ...base,
      ...(api.integer !== undefined ? { integer: api.integer } : {}),
      ...(api.enum ? { apiEnum: api.enum } : {}),
      ...(api.min !== undefined ? { capMin: api.min } : {}),
      ...(api.max !== undefined ? { capMax: api.max } : {}),
    };
  }

  if (api.type !== engine.type) {
    warnDisagreement(api.key, `type (${api.type})`);
  }
  if (
    api.type === "number" &&
    (api.integer ?? true) !== (engine.integer ?? true)
  ) {
    warnDisagreement(api.key, "integer flag");
  }
  let apiEnum: readonly string[] | undefined;
  if (api.enum) {
    const extra = api.enum.filter((v) => !engine.enum?.includes(v));
    if (extra.length > 0 && engine.enum) {
      warnDisagreement(api.key, `enum (${extra.join(", ")})`);
    }
    apiEnum = engine.enum
      ? api.enum.filter((v) => engine.enum?.includes(v))
      : api.enum;
  }

  return {
    ...base,
    type: engine.type,
    ...(engine.integer !== undefined ? { integer: engine.integer } : {}),
    ...(engine.enum ? { engineEnum: engine.enum } : {}),
    ...(apiEnum ? { apiEnum } : {}),
    ...(engine.min !== undefined ? { engineMin: engine.min } : {}),
    ...(engine.max !== undefined ? { engineMax: engine.max } : {}),
    ...(api.min !== undefined ? { capMin: api.min } : {}),
    ...(api.max !== undefined ? { capMax: api.max } : {}),
  };
}

/** Every setting in the response, in the API's order. Empty when the response has no `definitions`. */
export function resolveDefinitions(
  response: Pick<ProjectVoiceAdvancedSettingsResponse, "definitions">,
): ResolvedDef[] {
  return (response.definitions ?? []).map(fromApiDefinition);
}

export function getValueAtPath(
  source: Record<string, unknown> | undefined,
  path: readonly string[],
): unknown {
  let current: unknown = source;
  for (const part of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function responsePathForKey(key: string): string[] {
  return FLAT_RESPONSE_PATHS[key] ?? key.split(".");
}

/**
 * For a platform without `definitions`: the type comes from the value in `defaults` at the key's
 * path, and the engine facts from the catalog when the key is a catalog path. With neither, the
 * value is sent as text and the server decides.
 */
export function fallbackDefinition(
  key: string,
  response: Pick<ProjectVoiceAdvancedSettingsResponse, "defaults" | "settings">,
): ResolvedDef {
  const path = responsePathForKey(key);
  const fromDefaults = getValueAtPath(response.defaults, path);
  const fromSettings = getValueAtPath(response.settings, path);
  const sample = fromDefaults ?? fromSettings;
  const engine = catalogDef(key);

  const sampleType =
    typeof sample === "boolean" ||
    typeof sample === "number" ||
    typeof sample === "string"
      ? (typeof sample as "boolean" | "number" | "string")
      : undefined;
  const type = engine?.type ?? sampleType ?? "string";

  return {
    key,
    path,
    type,
    default: fromDefaults,
    // Without catalog facts a number may be fractional (`tts.speed`); the server checks it.
    integer: engine?.integer ?? false,
    ...(engine?.enum ? { engineEnum: engine.enum } : {}),
    ...(engine?.min !== undefined ? { engineMin: engine.min } : {}),
    ...(engine?.max !== undefined ? { engineMax: engine.max } : {}),
  };
}

export function parseVoiceAdvancedValue(
  def: ResolvedDef,
  raw: string,
): boolean | number | string {
  const { key } = def;

  if (def.type === "boolean") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
    throw new Error(`Invalid boolean for ${key}: use true or false`);
  }

  if (def.type === "number") {
    const n = raw.trim() === "" ? Number.NaN : Number(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid number for ${key}`);
    }
    if (def.integer !== false && !Number.isInteger(n)) {
      throw new Error(`${key} must be an integer`);
    }
    if (
      (def.engineMin !== undefined && n < def.engineMin) ||
      (def.engineMax !== undefined && n > def.engineMax)
    ) {
      throw new Error(
        `${key} must be between ${def.engineMin ?? "-inf"} and ${def.engineMax ?? "inf"} (engine range)`,
      );
    }
    if (
      (def.capMin !== undefined && n < def.capMin) ||
      (def.capMax !== undefined && n > def.capMax)
    ) {
      throw new Error(
        `${key} must be between ${def.capMin ?? "-inf"} and ${def.capMax ?? "inf"}`,
      );
    }
    return n;
  }

  // Strings, including the JSON-text keys, are sent as given; the server validates them.
  const trimmed = raw.trim();
  if (def.engineEnum && !def.engineEnum.includes(trimmed)) {
    throw new Error(`${key} must be one of: ${def.engineEnum.join(", ")}`);
  }
  if (def.apiEnum && !def.apiEnum.includes(trimmed)) {
    throw new Error(`${key} must be one of: ${def.apiEnum.join(", ")}`);
  }
  return trimmed;
}

function flattenLeaves(
  value: unknown,
  prefix: string[],
  out: Array<{ path: string[]; value: unknown }>,
): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      for (const [k, v] of entries) {
        flattenLeaves(v, [...prefix, k], out);
      }
      return;
    }
  }
  out.push({ path: prefix, value });
}

/** Keys of a response without `definitions`, taken from `settings`. */
export function keysFromSettings(settings: Record<string, unknown>): string[] {
  const leaves: Array<{ path: string[]; value: unknown }> = [];
  flattenLeaves(settings, [], leaves);
  const flatByPath = new Map(
    Object.entries(FLAT_RESPONSE_PATHS).map(([key, path]) => [
      path.join("."),
      key,
    ]),
  );
  return leaves
    .map((l) => flatByPath.get(l.path.join(".")) ?? l.path.join("."))
    .filter((k) => k !== "debug.ttsTextTraceUntil");
}

export function formatVoiceAdvancedSettingLine(
  settings: Record<string, unknown>,
  key: string,
  path: readonly string[] = responsePathForKey(key),
  fallbackValue?: unknown,
): string | null {
  const value = getValueAtPath(settings, path) ?? fallbackValue;
  if (value === undefined) {
    return null;
  }
  if (key === "debug.ttsTextTrace" && value === true) {
    const until = getValueAtPath(settings, ["debug", "ttsTextTraceUntil"]);
    if (typeof until === "string" && until.length > 0) {
      return `${key}=${String(value)} (on until ${until})`;
    }
  }
  return `${key}=${String(value)}`;
}

export function describeRange(def: ResolvedDef): string {
  const min = def.capMin ?? def.engineMin;
  const max = def.capMax ?? def.engineMax;
  // The u32 type range of an integer key says nothing to a user.
  if (def.capMax === undefined && max !== undefined && max >= U32_MAX) {
    return "";
  }
  if (def.type === "number" && min !== undefined && max !== undefined) {
    return ` [${min}–${max}]`;
  }
  const values = def.apiEnum ?? def.engineEnum;
  return values ? ` [${values.join("|")}]` : "";
}

export function voiceAdvancedSettingNamesHelp(): string {
  return "run `voicethere projects voice-advanced list` for every key";
}

export function formatVoiceAdvancedSettingsGroupHelp(): string {
  const lines = [
    "",
    "Advanced voice pipeline settings apply on the next deploy.",
    "Boolean values: true|false|1|0|yes|no|on|off.",
    "",
    "Voice engine settings (default in parentheses):",
  ];

  for (const path of VOICE_AGENT_SETTING_PATHS) {
    const def = VOICE_AGENT_SETTINGS[path];
    lines.push(
      `  ${path} (${String(def.default ?? "derived")})${describeRange(
        fromEngine(path, def),
      )}`,
    );
  }

  lines.push("");
  lines.push(
    "Project defaults, VoiceThere-only keys and descriptions come from the platform:",
  );
  lines.push("  $ voicethere projects voice-advanced list");
  lines.push("");
  lines.push("Examples:");
  lines.push(
    "  $ voicethere projects voice-advanced set vad.bargeIn.requireSttPartial false",
  );
  lines.push("  $ voicethere projects voice-advanced set tts.speed 0.9");
  lines.push("  $ voicethere projects voice-advanced set tts.sentenceCase off");
  lines.push(
    "  $ voicethere projects voice-advanced set debug.ttsTextTrace on",
  );
  lines.push(
    '  $ voicethere projects voice-advanced set voice.profilesByLanguage \'{"de":{"stt":"de","tts":"de-thorsten-high"}}\'',
  );
  lines.push(
    "  $ voicethere projects voice-advanced set languageId.autoSwitch.enabled true",
  );
  lines.push("  $ voicethere projects voice-advanced reset");

  return lines.join("\n");
}

function fromEngine(path: string, def: VoiceAgentSettingDef): ResolvedDef {
  return {
    key: path,
    path: path.split("."),
    type: def.type,
    ...(def.enum ? { engineEnum: def.enum } : {}),
    ...(def.min !== undefined ? { engineMin: def.min } : {}),
    ...(def.max !== undefined ? { engineMax: def.max } : {}),
  };
}
