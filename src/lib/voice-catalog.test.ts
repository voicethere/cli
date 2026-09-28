import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  customerSttProviderIds,
  customerTtsProviderIds,
} from "./voice-catalog.js";

const require = createRequire(import.meta.url);

describe("voice-catalog require loader", () => {
  it("loads STT/TTS ids via CJS require (Node ESM json workaround)", () => {
    expect(customerSttProviderIds()).toContain("openai");
    expect(customerTtsProviderIds()).toContain("openai");
    expect(customerSttProviderIds()).not.toContain("mock");
  });

  it("createRequire of the published package does not throw", () => {
    expect(() => require("@node-webrtc-rust/voice-catalog")).not.toThrow();
  });
});
