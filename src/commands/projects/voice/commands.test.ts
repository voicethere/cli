import { describe, expect, it } from "vitest";

import {
  assertSherpaModelId,
  formatSherpaModelChoiceLabel,
} from "./catalog.js";
import { assertVoiceProviders } from "./set.js";

describe("projects voice set", () => {
  it("rejects unknown STT provider", () => {
    expect(() => assertVoiceProviders("not-a-vendor", "openai")).toThrow(
      /Unknown STT provider/,
    );
    expect(() => assertVoiceProviders("openai", "not-a-vendor")).toThrow(
      /Unknown TTS provider/,
    );
  });

  it("accepts providers from fetched allow-lists", () => {
    expect(() =>
      assertVoiceProviders(
        "local-sherpa",
        "local-sherpa",
        new Set(["local-sherpa"]),
        new Set(["local-sherpa"]),
      ),
    ).not.toThrow();
    expect(() =>
      assertVoiceProviders(
        "openai",
        "local-sherpa",
        new Set(["local-sherpa"]),
        new Set(["local-sherpa"]),
      ),
    ).toThrow(/Unknown STT provider/);
  });
});

describe("projects voice catalog helpers", () => {
  const catalog = {
    default_stt_model_id: "en",
    default_tts_model_id: "en",
    release_stt_base: "https://example/asr",
    release_tts_base: "https://example/tts",
    stt_models: [
      {
        id: "en",
        label: "English",
        language: "en",
        bundle: "stt-en",
        kind: "transducer",
      },
    ],
    tts_models: [
      {
        id: "en-lessac-high",
        label: "Lessac high",
        language: "en",
        bundle: "vits-piper-en_US-lessac-high",
        kind: "vits",
        speaker_id: 0,
      },
    ],
  };

  it("assertSherpaModelId rejects unknown ids", () => {
    expect(() => assertSherpaModelId("TTS", "nope", catalog)).toThrow(
      /Unknown Sherpa TTS/,
    );
    expect(() =>
      assertSherpaModelId("TTS", "en-lessac-high", catalog),
    ).not.toThrow();
  });

  it("formatSherpaModelChoiceLabel includes id and bundle", () => {
    const label = formatSherpaModelChoiceLabel(catalog.tts_models[0]!);
    expect(label).toContain("en-lessac-high");
    expect(label).toContain("vits-piper-en_US-lessac-high");
  });
});
