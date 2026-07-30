export const SESSION_SETTING_KEYS = [
  "error_message",
  "idle_timeout_enabled",
  "idle_timeout_seconds",
  "data_only_idle_timeout_seconds",
  "idle_timeout_voice_activity",
  "idle_timeout_dc_inbound",
  "conversation_history_enabled",
] as const;

export type SessionSettingKey = (typeof SESSION_SETTING_KEYS)[number];

export const DEFAULT_IDLE_TIMEOUT_SECONDS = 30;
export const PLATFORM_IDLE_TIMEOUT_MAX_SECONDS = 120;
export const ABSOLUTE_IDLE_TIMEOUT_MAX_SECONDS = 86_400;
export const IDLE_TIMEOUT_MIN_SECONDS = 30;

export const SESSION_SETTING_DEFS: Record<
  SessionSettingKey,
  {
    type: "boolean" | "number" | "string";
    default: boolean | number | string | undefined;
    min?: number;
    max?: number;
    description: string;
    billingWarning?: boolean;
  }
> = {
  error_message: {
    type: "string",
    default: undefined,
    description:
      "TTS message when the agent crashes (voice mode). Empty omits AGENT_CRASH_TTS_MESSAGE.",
  },
  idle_timeout_enabled: {
    type: "boolean",
    default: true,
    description:
      "Disconnect idle WebRTC peers automatically. false keeps sessions billable longer.",
    billingWarning: true,
  },
  idle_timeout_seconds: {
    type: "number",
    default: DEFAULT_IDLE_TIMEOUT_SECONDS,
    min: IDLE_TIMEOUT_MIN_SECONDS,
    max: PLATFORM_IDLE_TIMEOUT_MAX_SECONDS,
    description:
      "Seconds without activity before disconnect (voice / both projects).",
    billingWarning: true,
  },
  data_only_idle_timeout_seconds: {
    type: "number",
    default: DEFAULT_IDLE_TIMEOUT_SECONDS,
    min: IDLE_TIMEOUT_MIN_SECONDS,
    max: PLATFORM_IDLE_TIMEOUT_MAX_SECONDS,
    description:
      "Seconds without client→server data-channel traffic (data-only projects).",
    billingWarning: true,
  },
  idle_timeout_voice_activity: {
    type: "boolean",
    default: true,
    description:
      "When on, user speech and agent TTS reset the idle countdown (voice / both projects). When off, voice does not reset the timer — the session can still hit the idle timeout during a call. Ignored when the project is data-only.",
  },
  idle_timeout_dc_inbound: {
    type: "boolean",
    default: true,
    description:
      "When on, client→server data-channel messages reset the idle countdown. When off, data-channel traffic does not extend the session.",
  },
  conversation_history_enabled: {
    type: "boolean",
    default: true,
    description:
      "When on (default), store final user speech and agent TTS text for the dashboard Conversation tab. false stops recording new transcripts (existing history kept until retention).",
  },
};

const SETTING_NAMES_HELP = SESSION_SETTING_KEYS.join(" | ");

export function sessionSettingNamesHelp(): string {
  return SETTING_NAMES_HELP;
}

function isIdleTimeoutSecondsKey(key: SessionSettingKey): boolean {
  return (
    key === "idle_timeout_seconds" || key === "data_only_idle_timeout_seconds"
  );
}

/** Shown by `voicethere projects session-settings --help`. */
export function formatSessionSettingsGroupHelp(): string {
  const lines = [
    "",
    "Settings apply on the next deploy (runner env). Boolean values: true|false|1|0|yes|no.",
    "",
    "Keys (default in parentheses):",
  ];

  for (const key of SESSION_SETTING_KEYS) {
    const def = SESSION_SETTING_DEFS[key];
    const defaultLabel =
      def.default === undefined ? "none" : String(def.default);
    const range =
      def.type === "number" && def.min !== undefined && def.max !== undefined
        ? isIdleTimeoutSecondsKey(key)
          ? ` [${def.min}–${def.max} default max; org may allow higher via API]`
          : ` [${def.min}–${def.max}]`
        : "";
    const billing = def.billingWarning ? " (billing)" : "";
    lines.push(`  ${key} (${defaultLabel})${range}${billing}`);
    lines.push(`    ${def.description}`);
  }

  lines.push("");
  lines.push("Examples:");
  lines.push("  $ voicethere projects session-settings list");
  lines.push(
    "  $ voicethere projects session-settings set idle_timeout_seconds 90",
  );
  lines.push(
    "  $ voicethere projects session-settings set idle_timeout_enabled false --project <uuid>",
  );
  lines.push(
    "  $ voicethere projects session-settings set conversation_history_enabled false",
  );

  return lines.join("\n");
}

export { isIdleTimeoutSecondsKey };
