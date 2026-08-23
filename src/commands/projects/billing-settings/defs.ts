export const BILLING_SETTING_KEYS = [
  "metered_overage_enabled",
  "conversation_overage_enabled",
  "agent_log_overage_enabled",
  "budget_cap_amount",
  "budget_cap_currency",
] as const;

export type BillingSettingKey = (typeof BILLING_SETTING_KEYS)[number];

export const BILLING_CURRENCY_VALUES = ["eur", "usd"] as const;
export type BillingCurrency = (typeof BILLING_CURRENCY_VALUES)[number];

/** Read-only fields included in `billing-settings list` output. */
export const BILLING_LIST_CONTEXT_KEYS = [
  "effective_metered_overage_enabled",
  "org_metered_overage_enabled",
  "org_payment_ready",
  "org_budget_cap_amount",
  "org_budget_cap_currency",
  "validation_warning",
] as const;

export type BillingListContextKey = (typeof BILLING_LIST_CONTEXT_KEYS)[number];

export const BILLING_SETTING_DEFS: Record<
  BillingSettingKey,
  {
    type: "boolean" | "number" | "currency" | "nullable_number";
    description: string;
    billingWarning?: boolean;
  }
> = {
  metered_overage_enabled: {
    type: "boolean",
    description:
      "When on, usage past included credits can bill at metered rates (requires org metered overage and a payment method).",
    billingWarning: true,
  },
  conversation_overage_enabled: {
    type: "boolean",
    description:
      "When on, conversation history past plan limits bills at overage credits instead of hard stop.",
    billingWarning: true,
  },
  agent_log_overage_enabled: {
    type: "boolean",
    description:
      "When on, agent logs past plan limits bill at overage credits instead of hard stop.",
    billingWarning: true,
  },
  budget_cap_amount: {
    type: "nullable_number",
    description:
      "Optional project spend cap in major currency units. Use null, none, or empty to clear.",
    billingWarning: true,
  },
  budget_cap_currency: {
    type: "currency",
    description:
      "Spend cap currency: eur or usd. Use null or none to clear when removing a cap.",
  },
};

const SETTING_NAMES_HELP = BILLING_SETTING_KEYS.join(" | ");

export function billingSettingNamesHelp(): string {
  return SETTING_NAMES_HELP;
}

/** Shown by `voicethere projects billing-settings --help`. */
export function formatBillingSettingsGroupHelp(): string {
  const lines = [
    "",
    "Project billing toggles and spend caps (dashboard Billing / subscriptions).",
    "Boolean values: true|false|1|0|yes|no. Clear budget_cap_amount with null|none|empty.",
    "",
    "Keys:",
  ];

  for (const key of BILLING_SETTING_KEYS) {
    const def = BILLING_SETTING_DEFS[key];
    const billing = def.billingWarning ? " (billing)" : "";
    lines.push(`  ${key}${billing}`);
    lines.push(`    ${def.description}`);
  }

  lines.push("");
  lines.push("Examples:");
  lines.push("  $ voicethere projects billing-settings list");
  lines.push(
    "  $ voicethere projects billing-settings set metered_overage_enabled true",
  );
  lines.push(
    "  $ voicethere projects billing-settings set budget_cap_amount 50",
  );
  lines.push(
    "  $ voicethere projects billing-settings set budget_cap_amount null",
  );
  lines.push(
    "  $ voicethere projects billing-settings set conversation_overage_enabled false --project <uuid>",
  );

  return lines.join("\n");
}
