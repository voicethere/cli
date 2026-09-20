import { describe, expect, it } from "vitest";
import {
  assertPlatformCreateTemplateId,
  loadTemplateWorkspaceSources,
  PLATFORM_CREATE_TEMPLATE_IDS,
  resolveTemplateEntryPath,
} from "./project-templates.js";

describe("project templates", () => {
  it("lists dashboard create templates including 0.8.0 world-sync ids", () => {
    expect(PLATFORM_CREATE_TEMPLATE_IDS).toEqual([
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
    ]);
  });

  it("resolves folder entries from @voicethere/agent 0.8.0", () => {
    expect(resolveTemplateEntryPath("blank")).toBe("agent.ts");
    expect(resolveTemplateEntryPath("echo")).toBe("echo/agent.ts");
    expect(resolveTemplateEntryPath("world-sync-binary")).toBe(
      "world-sync-binary/agent.ts",
    );
    expect(resolveTemplateEntryPath("spatial-showcase")).toBe(
      "spatial-showcase/agent.ts",
    );
  });

  it("loads binary world-sync sources from the installed agent package", () => {
    const files = loadTemplateWorkspaceSources("world-sync-binary");
    expect(files.map((file) => file.path)).toEqual([
      "world-sync-binary/agent.ts",
      "world-sync-binary/protocol.ts",
    ]);
    expect(files[0]?.content).toContain("onDataChannelBinary");
  });

  it("rejects unknown create template ids", () => {
    expect(() => assertPlatformCreateTemplateId("redis-sync")).toThrow(
      /Unknown template "redis-sync"/,
    );
  });
});
