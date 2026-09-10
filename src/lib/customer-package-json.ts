/** Customer workspace pin — may differ from the CLI runtime `@voicethere/agent` dependency. */
export const CUSTOMER_AGENT_VERSION = "0.7.6";

/** Extra npm deps for platform create templates (not in every agent registry release). */
const EXTRA_TEMPLATE_NPM_DEPS: Record<string, Record<string, string>> = {
  "game-sync": { ioredis: "^5.11.1" },
};

export interface BuildCustomerPackageJsonOptions {
  templateId: string;
  /** Agent entry relative to project root (e.g. `echo.ts`, `voice-showcase/agent.ts`). */
  entryPath: string;
  /** npm package `name` field — defaults to `voicethere-<templateId>`. */
  packageName?: string;
}

export function defaultCustomerPackageName(templateId: string): string {
  if (templateId === "blank") {
    return "voicethere-agent";
  }
  return `voicethere-${templateId}`;
}

export function buildCustomerPackageJson(
  options: BuildCustomerPackageJsonOptions,
): string {
  const { templateId, entryPath } = options;
  const name = options.packageName ?? defaultCustomerPackageName(templateId);
  const dependencies: Record<string, string> = {
    "@voicethere/agent": `^${CUSTOMER_AGENT_VERSION}`,
    ...(EXTRA_TEMPLATE_NPM_DEPS[templateId] ?? {}),
  };

  const pkg = {
    name,
    private: true,
    type: "module",
    dependencies,
    scripts: {
      build: `npx @voicethere/agent build --entry ${entryPath} --outfile dist/agent.js`,
      verify: `npx @voicethere/agent verify --entry ${entryPath} --outfile dist/agent.js`,
      "verify:start": `npx @voicethere/agent verify-start --entry ${entryPath} --outfile dist/agent.js`,
      upload: "voicethere build upload",
      deploy: "voicethere deploy --wait",
      "source:push": "voicethere source push",
      "source:pull": "voicethere source pull",
    },
  };

  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export const CUSTOMER_GITIGNORE = `node_modules/
dist/
.test-logs/
`;
