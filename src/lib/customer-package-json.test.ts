import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildCustomerPackageJson,
  CUSTOMER_AGENT_VERSION,
} from "./customer-package-json.js";

describe("CUSTOMER_AGENT_VERSION", () => {
  it("matches the @voicethere/agent dependency of the CLI", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@voicethere/agent"]).toBe(CUSTOMER_AGENT_VERSION);
  });

  it("matches the installed @voicethere/agent whose templates init copies", () => {
    const installed = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "node_modules/@voicethere/agent/package.json"),
        "utf8",
      ),
    ) as { version: string };
    expect(installed.version).toBe(CUSTOMER_AGENT_VERSION);
  });

  it("pins ^0.9.8 in a language-switch workspace", () => {
    const parsed = JSON.parse(
      buildCustomerPackageJson({
        templateId: "language-switch",
        entryPath: "language-switch/agent.ts",
      }),
    ) as { dependencies: Record<string, string> };
    expect(parsed.dependencies["@voicethere/agent"]).toBe("^0.9.8");
  });
});
