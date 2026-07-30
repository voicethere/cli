import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsVoiceAdvancedList } from "./list.js";
import {
  runProjectsVoiceAdvancedReset,
  runProjectsVoiceAdvancedSet,
} from "./set.js";

const listProjectVoiceAdvancedSettings = vi.fn();
const setProjectVoiceAdvancedSetting = vi.fn();
const resetProjectVoiceAdvancedSettings = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectVoiceAdvancedSettings,
    setProjectVoiceAdvancedSetting,
    resetProjectVoiceAdvancedSettings,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects voice-advanced commands", () => {
  beforeEach(() => {
    listProjectVoiceAdvancedSettings.mockReset();
    setProjectVoiceAdvancedSetting.mockReset();
    resetProjectVoiceAdvancedSettings.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("lists resolved advanced settings", async () => {
    listProjectVoiceAdvancedSettings.mockResolvedValue({
      project_id: "proj-1",
      settings: {
        vad: {
          enabled: true,
          bargeIn: { requireSttPartial: false },
        },
        events: { mode: "both" },
      },
    });

    await runProjectsVoiceAdvancedList({});

    expect(listProjectVoiceAdvancedSettings).toHaveBeenCalledWith("proj-1");
    expect(console.log).toHaveBeenCalledWith("vad.enabled=true");
    expect(console.log).toHaveBeenCalledWith(
      "vad.bargeIn.requireSttPartial=false",
    );
  });

  it("sets a boolean advanced setting", async () => {
    setProjectVoiceAdvancedSetting.mockResolvedValue({
      project_id: "proj-1",
      settings: { vad: { bargeIn: { requireSttPartial: false } } },
    });

    await runProjectsVoiceAdvancedSet({
      name: "vad.bargeIn.requireSttPartial",
      value: "false",
    });

    expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
      "proj-1",
      "vad.bargeIn.requireSttPartial",
      false,
    );
  });

  it("sets fractional tts.speed", async () => {
    setProjectVoiceAdvancedSetting.mockResolvedValue({
      project_id: "proj-1",
      settings: { tts: { speed: 0.7 } },
    });

    await runProjectsVoiceAdvancedSet({
      name: "tts.speed",
      value: "0.7",
    });

    expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
      "proj-1",
      "tts.speed",
      0.7,
    );
  });

  it("rejects tts.speed outside 0.2–2.0", async () => {
    await expect(
      runProjectsVoiceAdvancedSet({ name: "tts.speed", value: "0.1" }),
    ).rejects.toThrow(/between 0\.2 and 2/);
  });

  it("resets advanced settings", async () => {
    resetProjectVoiceAdvancedSettings.mockResolvedValue({
      project_id: "proj-1",
      settings: { vad: { gateStt: true }, events: { mode: "both" } },
    });

    await runProjectsVoiceAdvancedReset({});

    expect(resetProjectVoiceAdvancedSettings).toHaveBeenCalledWith("proj-1");
  });
});
