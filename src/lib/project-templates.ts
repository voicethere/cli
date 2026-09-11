import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  getTemplate,
  type TemplateSourceFile,
} from "@voicethere/agent/templates";

/** Templates accepted by POST /projects (`template` field). */
export const PLATFORM_CREATE_TEMPLATE_IDS = [
  "blank",
  "voice-starter",
  "echo-dc",
  "echo",
  "voice-showcase",
  "game-sync",
  "recording-consent",
  "positional-tts",
] as const;

export type PlatformCreateTemplateId =
  (typeof PLATFORM_CREATE_TEMPLATE_IDS)[number];

const PLATFORM_CREATE_TEMPLATE_SET = new Set<string>(
  PLATFORM_CREATE_TEMPLATE_IDS,
);

/** Registry entries for templates shipped in newer @voicethere/agent releases. */
const EXTENDED_TEMPLATE_SOURCE_FILES: Record<string, string[]> = {
  "voice-showcase": [
    "voice-showcase/agent.ts",
    "voice-showcase/conversation.ts",
    "voice-showcase/delivery.ts",
    "voice-showcase/weather.ts",
    "voice-showcase/recipes.ts",
    "voice-showcase/fun-facts.ts",
  ],
  "recording-consent": [
    "recording-consent/agent.ts",
    "recording-consent/conversation.ts",
  ],
  "positional-tts": ["positional-tts/agent.ts", "positional-tts/orbit.ts"],
};

const EXTENDED_TEMPLATE_ENTRIES: Record<string, string> = {
  "voice-showcase": "voice-showcase/agent.ts",
  "recording-consent": "recording-consent/agent.ts",
  "positional-tts": "positional-tts/agent.ts",
};

const require = createRequire(import.meta.url);
const templatesModulePath = require.resolve("@voicethere/agent/templates");
const AGENT_TEMPLATES_DIR = join(
  dirname(templatesModulePath),
  "..",
  "..",
  "templates",
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

  try {
    return getTemplate(templateId).entry;
  } catch {
    const extended = EXTENDED_TEMPLATE_ENTRIES[templateId];
    if (extended) {
      return extended;
    }
    throw new Error(`Unknown agent template id: ${templateId}`);
  }
}

function readTemplateFile(sourceFile: string): string {
  const absolutePath = join(AGENT_TEMPLATES_DIR, sourceFile);
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    throw new Error(
      `Template source not found: ${sourceFile}. Update @voicethere/agent or pick another --template.`,
    );
  }
}

/** Load template sources with registry-relative paths (dashboard Code UI parity). */
export function loadTemplateWorkspaceSources(
  templateId: string,
): TemplateSourceFile[] {
  if (templateId === "blank") {
    return [{ path: BLANK_AGENT_ENTRY, content: BLANK_AGENT_SOURCE }];
  }

  let sourceFiles: string[];
  try {
    sourceFiles = getTemplate(templateId).sourceFiles;
  } catch {
    const extended = EXTENDED_TEMPLATE_SOURCE_FILES[templateId];
    if (!extended) {
      throw new Error(`Unknown agent template id: ${templateId}`);
    }
    sourceFiles = extended;
  }

  return sourceFiles.map((sourceFile) => ({
    path: sourceFile,
    content: readTemplateFile(sourceFile),
  }));
}
