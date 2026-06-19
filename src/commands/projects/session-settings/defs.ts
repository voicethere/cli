export const SESSION_SETTING_KEYS = [
  "error_message",
  "idle_timeout_enabled",
  "idle_timeout_seconds",
  "data_only_idle_timeout_seconds",
  "idle_timeout_voice_activity",
  "idle_timeout_dc_inbound",
] as const;

export type SessionSettingKey = (typeof SESSION_SETTING_KEYS)[number];

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
    default: 600,
    min: 30,
    max: 86_400,
    description:
      "Seconds without activity before disconnect (voice / both projects).",
    billingWarning: true,
  },
  data_only_idle_timeout_seconds: {
    type: "number",
    default: 120,
    min: 30,
    max: 86_400,
    description:
      "Seconds without client→server data-channel traffic (data-only projects).",
    billingWarning: true,
  },
  idle_timeout_voice_activity: {
    type: "boolean",
    default: true,
    description:
      "Reset idle timer on speech events and agent TTS (voice / both). Ignored when project is data-only.",
  },
  idle_timeout_dc_inbound: {
    type: "boolean",
    default: true,
    description:
      "Reset idle timer when the client sends data-channel messages (all modes).",
  },
};

const SETTING_NAMES_HELP = SESSION_SETTING_KEYS.join(" | ");

export function sessionSettingNamesHelp(): string {
  return SETTING_NAMES_HELP;
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
        ? ` [${def.min}–${def.max}]`
        : "";
    const billing = def.billingWarning ? " (billing)" : "";
    lines.push(`  ${key} (${defaultLabel})${range}${billing}`);
    lines.push(`    ${def.description}`);
  }

  lines.push("");
  lines.push("Examples:");
  lines.push("  $ voicethere projects session-settings list");
  lines.push(
    "  $ voicethere projects session-settings set idle_timeout_seconds 300",
  );
  lines.push(
    "  $ voicethere projects session-settings set idle_timeout_enabled false --project <uuid>",
  );

  return lines.join("\n");
}
