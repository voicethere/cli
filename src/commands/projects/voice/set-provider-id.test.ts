import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getProjectVoiceSettings: vi.fn(),
  listVoiceModels: vi.fn(),
  listSherpaModels: vi.fn(),
  updateProjectVoiceSettings: vi.fn(),
}));

vi.mock("../../../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: () => api,
}));
vi.mock("../../../lib/config.js", () => ({
  requireCredentials: async () => ({}),
}));
vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: async () => "proj-1",
}));

import { runProjectsVoiceSet } from "./set.js";

function catalogListing(builtIn: string) {
  const provider = (id: string) => ({
    id,
    label: id,
    notes: "",
    required_credentials: [],
  });
  return {
    stt_providers: [provider(builtIn), provider("openai")],
    tts_providers: [provider(builtIn), provider("openai")],
  };
}

const sherpa = {
  default_stt_model_id: "en",
  default_tts_model_id: "en",
  stt_models: [{ id: "en", label: "English", language: "en", bundle: "b" }],
  tts_models: [{ id: "en", label: "English", language: "en", bundle: "b" }],
};

function currentSettings(provider: string) {
  return {
    stt_provider: provider,
    tts_provider: provider,
    stt_model_id: "en",
    tts_model_id: "en",
  };
}

describe("voice set built-in provider id", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    api.listSherpaModels.mockResolvedValue(sherpa);
    api.updateProjectVoiceSettings.mockResolvedValue({});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("voice set --stt-provider voicethere against a catalog listing voicethere sends voicethere", async () => {
    api.getProjectVoiceSettings.mockResolvedValue(currentSettings("openai"));
    api.listVoiceModels.mockResolvedValue(catalogListing("voicethere"));
    await runProjectsVoiceSet({ sttProvider: "voicethere" });
    expect(api.updateProjectVoiceSettings.mock.calls[0]![1]).toMatchObject({
      stt_provider: "voicethere",
      tts_provider: "openai",
    });
  });

  it("voice set --stt-provider voicethere against an older catalog listing local-sherpa sends local-sherpa", async () => {
    api.getProjectVoiceSettings.mockResolvedValue(currentSettings("openai"));
    api.listVoiceModels.mockResolvedValue(catalogListing("local-sherpa"));
    await runProjectsVoiceSet({ sttProvider: "voicethere" });
    expect(api.updateProjectVoiceSettings.mock.calls[0]![1]).toMatchObject({
      stt_provider: "local-sherpa",
    });
  });

  it("voice set --stt-provider local-sherpa against a catalog listing voicethere is accepted and sends voicethere", async () => {
    api.getProjectVoiceSettings.mockResolvedValue(currentSettings("openai"));
    api.listVoiceModels.mockResolvedValue(catalogListing("voicethere"));
    await runProjectsVoiceSet({ sttProvider: "local-sherpa" });
    expect(api.updateProjectVoiceSettings.mock.calls[0]![1]).toMatchObject({
      stt_provider: "voicethere",
    });
  });

  it("voice set with current settings stt_provider voicethere validates the VoiceThere model id", async () => {
    api.getProjectVoiceSettings.mockResolvedValue(
      currentSettings("voicethere"),
    );
    api.listVoiceModels.mockResolvedValue(catalogListing("voicethere"));
    await expect(
      runProjectsVoiceSet({ sttModelId: "not-a-model" }),
    ).rejects.toThrow(/Unknown VoiceThere STT/);
    expect(api.updateProjectVoiceSettings).not.toHaveBeenCalled();
  });
});
