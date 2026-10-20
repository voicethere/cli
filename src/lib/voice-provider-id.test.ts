import { describe, expect, it } from "vitest";
import {
  isVoiceThereProvider,
  normalizeProviderInput,
} from "./voice-provider-id.js";

describe("voice provider id", () => {
  it("isVoiceThereProvider accepts every built-in spelling", () => {
    for (const id of [
      "voicethere",
      "local-sherpa",
      "cluster-sherpa",
      " VoiceThere ",
      "LOCAL-SHERPA",
    ]) {
      expect(isVoiceThereProvider(id)).toBe(true);
    }
  });

  it("isVoiceThereProvider rejects cloud vendors and empty input", () => {
    expect(isVoiceThereProvider("openai")).toBe(false);
    expect(isVoiceThereProvider("")).toBe(false);
    expect(isVoiceThereProvider(undefined)).toBe(false);
  });

  it("normalizeProviderInput maps built-in spellings to voicethere", () => {
    expect(normalizeProviderInput("local-sherpa")).toBe("voicethere");
    expect(normalizeProviderInput(" cluster-sherpa ")).toBe("voicethere");
    expect(normalizeProviderInput("voicethere")).toBe("voicethere");
  });

  it("normalizeProviderInput trims and keeps other ids unchanged", () => {
    expect(normalizeProviderInput(" openai ")).toBe("openai");
  });
});
