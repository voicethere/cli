import { describe, expect, it } from "vitest";

import { assertVoiceProviders } from "./set.js";

describe("projects voice set", () => {
  it("rejects unknown STT provider", () => {
    expect(() => assertVoiceProviders("not-a-vendor", "openai")).toThrow(
      /Unknown STT provider/,
    );
  });

  it("rejects unknown TTS provider", () => {
    expect(() => assertVoiceProviders("openai", "not-a-vendor")).toThrow(
      /Unknown TTS provider/,
    );
  });
});
