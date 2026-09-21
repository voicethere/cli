import { describe, expect, it } from "vitest";
import { listTemplates } from "@voicethere/agent/templates";
import {
  AGENT_TEMPLATES_TREE_URL,
  assertPlatformCreateTemplateId,
  formatInitTemplateHelp,
  listInitTemplateIds,
  listProductTemplateIds,
  loadTemplateWorkspaceSources,
  PLATFORM_CREATE_TEMPLATE_IDS,
  resolveTemplateEntryPath,
  templateNpmDependencies,
} from "./project-templates.js";

describe("project templates", () => {
  it("follows the installed @voicethere/agent product registry plus blank", () => {
    const productIds = listTemplates({ kind: "product" }).map(
      (template) => template.id,
    );
    expect(listProductTemplateIds()).toEqual(productIds);
    expect(listInitTemplateIds()).toEqual(["blank", ...productIds]);
    expect(PLATFORM_CREATE_TEMPLATE_IDS).toEqual(listInitTemplateIds());
    expect(listInitTemplateIds()).toContain("echo");
    expect(listInitTemplateIds()).toContain("webhooks");
    expect(listInitTemplateIds()).toContain("webhooks-redis");
  });

  it("does not treat e2e templates as init ids", () => {
    const initIds = new Set(listInitTemplateIds());
    for (const template of listTemplates({ kind: "e2e" })) {
      expect(initIds.has(template.id)).toBe(false);
    }
  });

  it("resolves folder entries from the installed agent package", () => {
    expect(resolveTemplateEntryPath("blank")).toBe("agent.ts");
    expect(resolveTemplateEntryPath("echo")).toBe("echo/agent.ts");
    expect(resolveTemplateEntryPath("world-sync-binary")).toBe(
      "world-sync-binary/agent.ts",
    );
    expect(resolveTemplateEntryPath("webhooks")).toBe("webhooks/agent.ts");
  });

  it("loads binary world-sync sources from the installed agent package", () => {
    const files = loadTemplateWorkspaceSources("world-sync-binary");
    expect(files.map((file) => file.path)).toEqual([
      "world-sync-binary/agent.ts",
      "world-sync-binary/protocol.ts",
    ]);
    expect(files[0]?.content).toContain("onDataChannelBinary");
  });

  it("loads webhook template sources from the installed agent package", () => {
    const files = loadTemplateWorkspaceSources("webhooks");
    expect(files.map((file) => file.path)).toEqual(["webhooks/agent.ts"]);
    expect(files[0]?.content).toContain("onWebhook");
  });

  it("reads extra npm deps from the agent registry", () => {
    expect(templateNpmDependencies("blank")).toEqual({});
    expect(templateNpmDependencies("echo")).toEqual({});
    expect(templateNpmDependencies("game-sync")).toMatchObject({
      ioredis: "^5.11.1",
    });
    expect(templateNpmDependencies("webhooks-redis")).toMatchObject({
      ioredis: "^5.11.1",
    });
  });

  it("rejects e2e-only templates with a distinct error", () => {
    expect(() => assertPlatformCreateTemplateId("redis-sync")).toThrow(
      /e2e-only template/,
    );
  });

  it("rejects unknown create template ids", () => {
    expect(() => assertPlatformCreateTemplateId("not-a-template")).toThrow(
      /Unknown template "not-a-template"/,
    );
  });

  it("lists every product template and the GitHub permalink in --help text", () => {
    const help = formatInitTemplateHelp();
    expect(help).toContain(AGENT_TEMPLATES_TREE_URL);
    expect(help).toContain("blank");
    for (const template of listTemplates({ kind: "product" })) {
      expect(help).toContain(template.id);
    }
    expect(help).toContain("E2e-only");
    expect(help).toContain("echo-smoke");
  });
});
