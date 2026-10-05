import { beforeEach, describe, expect, it, vi } from "vitest";

const listSherpaModels = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: vi.fn().mockResolvedValue({ api_key: "vth_test" }),
}));
vi.mock("../../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: () => ({ listSherpaModels }),
}));

import { runProjectsVoiceCatalog } from "./catalog.js";

describe("projects voice catalog output", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    listSherpaModels.mockResolvedValue({
      default_stt_model_id: "stt-1",
      default_tts_model_id: "tts-1",
      stt_models: [
        { id: "stt-1", label: "STT one", language: "en", bundle: "b1" },
      ],
      tts_models: [
        { id: "tts-1", label: "TTS one", language: "en", bundle: "b2" },
      ],
    });
  });

  it("names the built-in vendor VoiceThere in the headings", async () => {
    await runProjectsVoiceCatalog({});
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(
      lines.some((l) => l.includes("VoiceThere speech-to-text models")),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes("VoiceThere text-to-speech models")),
    ).toBe(true);
    expect(lines.join("\n")).not.toMatch(/Sherpa/);
  });
});
