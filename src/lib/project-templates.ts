import {
  getTemplate,
  listTemplates,
  loadTemplateWorkspaceSources as loadAgentTemplateWorkspaceSources,
  type TemplateSourceFile,
} from "@voicethere/agent/templates";

export const BLANK_TEMPLATE_ID = "blank";

/** Permalink to the agent template sources on GitHub. */
export const AGENT_TEMPLATES_TREE_URL =
  "https://github.com/voicethere/agent/tree/main/templates";

export const BLANK_AGENT_ENTRY = "agent.ts";

export const BLANK_AGENT_SOURCE = `import { defineAgent } from "@voicethere/agent";

defineAgent({
  onSessionStart() {
    // Add your agent logic here.
  },
});
`;

export function listProductTemplateIds(): string[] {
  return listTemplates({ kind: "product" }).map((template) => template.id);
}

/** Ids accepted by `voicethere init --template` (blank + live product registry). */
export function listInitTemplateIds(): string[] {
  return [BLANK_TEMPLATE_ID, ...listProductTemplateIds()];
}

/** Live list from the installed `@voicethere/agent` package at module load. */
export const PLATFORM_CREATE_TEMPLATE_IDS = listInitTemplateIds();

export type PlatformCreateTemplateId = string;

export function isPlatformCreateTemplateId(id: string): boolean {
  return listInitTemplateIds().includes(id);
}

export function assertPlatformCreateTemplateId(id: string): void {
  if (isPlatformCreateTemplateId(id)) {
    return;
  }

  const e2eMatch = listTemplates({ kind: "e2e" }).find(
    (template) => template.id === id,
  );
  if (e2eMatch) {
    throw new Error(
      `"${id}" is an e2e-only template. Choose a product template or blank: ${listInitTemplateIds().join(", ")}`,
    );
  }

  throw new Error(
    `Unknown template "${id}". Choose one of: ${listInitTemplateIds().join(", ")}`,
  );
}

export function resolveTemplateEntryPath(templateId: string): string {
  if (templateId === BLANK_TEMPLATE_ID) {
    return BLANK_AGENT_ENTRY;
  }

  return getTemplate(templateId).entry;
}

/** Load template sources with registry-relative paths (dashboard Code UI parity). */
export function loadTemplateWorkspaceSources(
  templateId: string,
): TemplateSourceFile[] {
  if (templateId === BLANK_TEMPLATE_ID) {
    return [{ path: BLANK_AGENT_ENTRY, content: BLANK_AGENT_SOURCE }];
  }

  return loadAgentTemplateWorkspaceSources(templateId);
}

export function templateNpmDependencies(
  templateId: string,
): Record<string, string> {
  if (templateId === BLANK_TEMPLATE_ID) {
    return {};
  }

  return getTemplate(templateId).npmDependencies ?? {};
}

export function formatInitTemplateHelp(): string {
  const product = listTemplates({ kind: "product" });
  const e2e = listTemplates({ kind: "e2e" });
  const idWidth = Math.max(
    BLANK_TEMPLATE_ID.length,
    ...product.map((template) => template.id.length),
  );

  return [
    "",
    "Templates (from the installed @voicethere/agent package, plus blank):",
    `  ${BLANK_TEMPLATE_ID.padEnd(idWidth)}  Minimal stub (agent.ts) — CLI only`,
    ...product.map(
      (template) =>
        `  ${template.id.padEnd(idWidth)}  ${template.description}`,
    ),
    "",
    `E2e-only (not accepted by init): ${e2e.map((template) => template.id).join(", ")}`,
    `Sources: ${AGENT_TEMPLATES_TREE_URL}`,
  ].join("\n");
}
