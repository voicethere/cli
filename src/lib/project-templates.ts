import {
  getTemplate,
  loadTemplateWorkspaceSources as loadAgentTemplateWorkspaceSources,
  type TemplateSourceFile,
} from "@voicethere/agent/templates";

/** Templates accepted by POST /projects (`template` field). */
export const PLATFORM_CREATE_TEMPLATE_IDS = [
  "blank",
  "voice-starter",
  "echo-dc",
  "echo",
  "voice-showcase",
  "world-sync",
  "world-sync-binary",
  "game-sync",
  "recording-consent",
  "positional-tts",
  "spatial-showcase",
] as const;

export type PlatformCreateTemplateId =
  (typeof PLATFORM_CREATE_TEMPLATE_IDS)[number];

const PLATFORM_CREATE_TEMPLATE_SET = new Set<string>(
  PLATFORM_CREATE_TEMPLATE_IDS,
);

export const BLANK_AGENT_ENTRY = "agent.ts";

export const BLANK_AGENT_SOURCE = `import { defineAgent } from "@voicethere/agent";

defineAgent({
  onSessionStart() {
    // Add your agent logic here.
  },
});
`;

export function isPlatformCreateTemplateId(
  id: string,
): id is PlatformCreateTemplateId {
  return PLATFORM_CREATE_TEMPLATE_SET.has(id);
}

export function assertPlatformCreateTemplateId(id: string): void {
  if (!isPlatformCreateTemplateId(id)) {
    throw new Error(
      `Unknown template "${id}". Choose one of: ${PLATFORM_CREATE_TEMPLATE_IDS.join(", ")}`,
    );
  }
}

export function resolveTemplateEntryPath(templateId: string): string {
  if (templateId === "blank") {
    return BLANK_AGENT_ENTRY;
  }

  return getTemplate(templateId).entry;
}

/** Load template sources with registry-relative paths (dashboard Code UI parity). */
export function loadTemplateWorkspaceSources(
  templateId: string,
): TemplateSourceFile[] {
  if (templateId === "blank") {
    return [{ path: BLANK_AGENT_ENTRY, content: BLANK_AGENT_SOURCE }];
  }

  return loadAgentTemplateWorkspaceSources(templateId);
}
