import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOICE_ADVANCED_SETTING_DEFS,
  VOICE_ADVANCED_SETTING_KEYS,
} from "./defs.js";
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

  it("lists every canonical voice-advanced key", () => {
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain("noiseSuppression.enabled");
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain("languageId.enabled");
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain("languageId.minSpeechMs");
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain(
      "languageId.autoSwitch.enabled",
    );
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain("voice.profilesByLanguage");
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain("tts.phraseCache");
    expect(VOICE_ADVANCED_SETTING_KEYS).toContain(
      "connection.reconnectWindowSec",
    );
    expect(VOICE_ADVANCED_SETTING_KEYS).toHaveLength(41);
    expect(VOICE_ADVANCED_SETTING_KEYS).not.toContain(
      "voice.expectedLanguages",
    );
    for (const key of [
      "languageId.autoSwitch.waitAudio",
      "languageId.autoSwitch.waitMessage.mode",
      "languageId.autoSwitch.waitMessage.skipWhenReady",
      "languageId.autoSwitch.waitMessage.texts",
      "languageId.autoSwitch.readyMessage.minSwitchMs",
      "languageId.autoSwitch.readyMessage.texts",
    ]) {
      expect(VOICE_ADVANCED_SETTING_KEYS).toContain(key);
    }
  });

  it("lists resolved advanced settings", async () => {
    listProjectVoiceAdvancedSettings.mockResolvedValue({
      project_id: "proj-1",
      settings: {
        vad: {
          enabled: true,
          bargeIn: { requireSttPartial: false },
        },
        noiseSuppression: { enabled: true },
        events: { mode: "both" },
      },
    });

    await runProjectsVoiceAdvancedList({});

    expect(listProjectVoiceAdvancedSettings).toHaveBeenCalledWith("proj-1");
    expect(console.log).toHaveBeenCalledWith("vad.enabled=true");
    expect(console.log).toHaveBeenCalledWith(
      "vad.bargeIn.requireSttPartial=false",
    );
    expect(console.log).toHaveBeenCalledWith("noiseSuppression.enabled=true");
  });

  it("sets noiseSuppression.enabled false", async () => {
    setProjectVoiceAdvancedSetting.mockResolvedValue({
      project_id: "proj-1",
      settings: { noiseSuppression: { enabled: false } },
    });

    await runProjectsVoiceAdvancedSet({
      name: "noiseSuppression.enabled",
      value: "false",
    });

    expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
      "proj-1",
      "noiseSuppression.enabled",
      false,
    );
    expect(console.log).toHaveBeenCalledWith("noiseSuppression.enabled=false");
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
    expect(console.log).toHaveBeenCalledWith(
      "vad.bargeIn.requireSttPartial=false",
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
    expect(console.log).toHaveBeenCalledWith("tts.speed=0.7");
  });

  it("defines tts.phraseCache as a boolean that defaults to on", () => {
    expect(VOICE_ADVANCED_SETTING_DEFS["tts.phraseCache"]).toMatchObject({
      type: "boolean",
      default: true,
    });
  });

  it("sets tts.phraseCache true and false and rejects other values", async () => {
    setProjectVoiceAdvancedSetting.mockResolvedValue({
      project_id: "proj-1",
      settings: {},
    });

    await runProjectsVoiceAdvancedSet({ name: "tts.phraseCache", value: "false" });
    expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
      "proj-1",
      "tts.phraseCache",
      false,
    );
    expect(console.log).toHaveBeenCalledWith("tts.phraseCache=false");

    await runProjectsVoiceAdvancedSet({ name: "tts.phraseCache", value: "true" });
    expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
      "proj-1",
      "tts.phraseCache",
      true,
    );

    await expect(
      runProjectsVoiceAdvancedSet({ name: "tts.phraseCache", value: "maybe" }),
    ).rejects.toThrow(/Invalid boolean/);
  });

  describe("connection.reconnectWindowSec", () => {
    it("is a number 15-30 that defaults to 15", () => {
      expect(
        VOICE_ADVANCED_SETTING_DEFS["connection.reconnectWindowSec"],
      ).toMatchObject({ type: "number", min: 15, max: 30, default: 15 });
    });

    it("appears in the list output with default 15", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: { connection: { reconnectWindowSec: 15 } },
      });

      await runProjectsVoiceAdvancedList({});

      expect(console.log).toHaveBeenCalledWith(
        "connection.reconnectWindowSec=15",
      );
    });

    it("sets connection.reconnectWindowSec to 30", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: { connection: { reconnectWindowSec: 30 } },
      });

      await runProjectsVoiceAdvancedSet({
        name: "connection.reconnectWindowSec",
        value: "30",
      });

      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "connection.reconnectWindowSec",
        30,
      );
      expect(console.log).toHaveBeenCalledWith(
        "connection.reconnectWindowSec=30",
      );
    });

    it.each(["14", "31", "15.5", "abc"])("rejects %s", async (value) => {
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "connection.reconnectWindowSec",
          value,
        }),
      ).rejects.toThrow();
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
    });

    it("accepts 15", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      await runProjectsVoiceAdvancedSet({
        name: "connection.reconnectWindowSec",
        value: "15",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "connection.reconnectWindowSec",
        15,
      );
    });
  });

  it("rejects tts.speed outside 0.2–2.0", async () => {
    await expect(
      runProjectsVoiceAdvancedSet({ name: "tts.speed", value: "0.1" }),
    ).rejects.toThrow(/between 0\.2 and 2/);
  });

  describe("language switch wait settings", () => {
    const set = (name: string, value: string) =>
      runProjectsVoiceAdvancedSet({ name, value });

    it("rejects the removed voice.expectedLanguages key", async () => {
      await expect(set("voice.expectedLanguages", "en,de")).rejects.toThrow(
        /Unknown voice advanced setting voice\.expectedLanguages/,
      );
    });

    it("accepts each waitAudio value and rejects others", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      for (const value of ["buffer_replay", "first_utterance"]) {
        await set("languageId.autoSwitch.waitAudio", value);
        expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
          "proj-1",
          "languageId.autoSwitch.waitAudio",
          value,
        );
      }
      await expect(
        set("languageId.autoSwitch.waitAudio", "all"),
      ).rejects.toThrow(/must be one of: buffer_replay, first_utterance/);
    });

    it("accepts each waitMessage.mode value and rejects others", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      for (const value of ["end_of_utterance", "immediate", "off"]) {
        await set("languageId.autoSwitch.waitMessage.mode", value);
        expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
          "proj-1",
          "languageId.autoSwitch.waitMessage.mode",
          value,
        );
      }
      await expect(
        set("languageId.autoSwitch.waitMessage.mode", "later"),
      ).rejects.toThrow(/must be one of: end_of_utterance, immediate, off/);
    });

    it("parses waitMessage.skipWhenReady as a boolean", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      await set("languageId.autoSwitch.waitMessage.skipWhenReady", "no");
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        "languageId.autoSwitch.waitMessage.skipWhenReady",
        false,
      );
      await expect(
        set("languageId.autoSwitch.waitMessage.skipWhenReady", "maybe"),
      ).rejects.toThrow(/Invalid boolean/);
    });

    it("validates waitMessage.texts JSON", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      const key = "languageId.autoSwitch.waitMessage.texts";
      await set(key, '{"en":"One moment, switching."}');
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        key,
        '{"en":"One moment, switching."}',
      );
      await expect(set(key, "nope")).rejects.toThrow(/valid JSON object/);
      await expect(set(key, "[]")).rejects.toThrow(
        /JSON object keyed by language code/,
      );
      await expect(set(key, '{"english":"x"}')).rejects.toThrow(
        /invalid language key/,
      );
      await expect(set(key, '{"en":3}')).rejects.toThrow(/non-empty string/);
      await expect(set(key, '{"en":" "}')).rejects.toThrow(/non-empty string/);
      await expect(
        set(key, JSON.stringify({ en: "a".repeat(301) })),
      ).rejects.toThrow(/at most 300 characters/);
    });

    it("validates voice.profilesByLanguage shape", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      const key = "voice.profilesByLanguage";
      await set(key, '{"de":{"stt":"de","tts":"de-thorsten-high"}}');
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        key,
        '{"de":{"stt":"de","tts":"de-thorsten-high"}}',
      );
      await expect(set(key, "{")).rejects.toThrow(/valid JSON object/);
      await expect(set(key, '{"german":{"stt":"de"}}')).rejects.toThrow(
        /invalid language key/,
      );
      await expect(set(key, '{"de":"de"}')).rejects.toThrow(
        /must be an object/,
      );
      await expect(set(key, '{"de":{"stt":5}}')).rejects.toThrow(
        /must be a string/,
      );
      await expect(set(key, '{"de":{}}')).rejects.toThrow(/is empty/);
    });

    it("sets languageId.timing to each allowed value and rejects others", async () => {
      expect(VOICE_ADVANCED_SETTING_KEYS).toContain("languageId.timing");
      expect(VOICE_ADVANCED_SETTING_KEYS).not.toContain(
        "languageId.continuous",
      );
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      for (const value of ["early", "end_of_utterance", "continuous"]) {
        await set("languageId.timing", value);
        expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
          "proj-1",
          "languageId.timing",
          value,
        );
      }
      await expect(set("languageId.timing", "true")).rejects.toThrow(
        /must be one of: early, end_of_utterance, continuous/,
      );
    });

    it("defaults minSpeechMs to 1500 within 1000–5000", async () => {
      expect(
        VOICE_ADVANCED_SETTING_DEFS["languageId.minSpeechMs"],
      ).toMatchObject({
        default: 1500,
        min: 1000,
        max: 5000,
      });
      expect(VOICE_ADVANCED_SETTING_DEFS["languageId.timing"].default).toBe(
        "early",
      );
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      await expect(set("languageId.minSpeechMs", "999")).rejects.toThrow(
        /between 1000 and 5000/,
      );
    });

    it("accepts finalHoldMs up to 10000 like the dashboard", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      await set("languageId.autoSwitch.finalHoldMs", "10000");
      await expect(
        set("languageId.autoSwitch.finalHoldMs", "10001"),
      ).rejects.toThrow(/between 0 and 10000/);
    });

    it("validates readyMessage.minSwitchMs as 0-15000", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      const key = "languageId.autoSwitch.readyMessage.minSwitchMs";
      expect(VOICE_ADVANCED_SETTING_DEFS[key]).toMatchObject({
        default: 2000,
        min: 0,
        max: 15000,
      });
      await set(key, "0");
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        key,
        0,
      );
      await set(key, "15000");
      await expect(set(key, "15001")).rejects.toThrow(/between 0 and 15000/);
      await expect(set(key, "-1")).rejects.toThrow(/between 0 and 15000/);
      await expect(set(key, "soon")).rejects.toThrow(/Invalid number/);
    });

    it("validates readyMessage.texts JSON", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });
      const key = "languageId.autoSwitch.readyMessage.texts";
      await set(key, '{"de":"Okay, machen wir auf Deutsch weiter."}');
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        key,
        '{"de":"Okay, machen wir auf Deutsch weiter."}',
      );
      await expect(set(key, "nope")).rejects.toThrow(/valid JSON object/);
      await expect(set(key, '{"english":"x"}')).rejects.toThrow(
        /invalid language key/,
      );
      await expect(
        set(key, JSON.stringify({ de: "a".repeat(301) })),
      ).rejects.toThrow(/at most 300 characters/);
    });

    it("lists the ready message settings from the flat API shape", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          languageId: {
            autoSwitch: {
              readyMessageMinSwitchMs: 3000,
              readyMessageTexts: '{"de":"Okay."}',
            },
          },
        },
      });
      await runProjectsVoiceAdvancedList({});
      expect(console.log).toHaveBeenCalledWith(
        "languageId.autoSwitch.readyMessage.minSwitchMs=3000",
      );
      expect(console.log).toHaveBeenCalledWith(
        'languageId.autoSwitch.readyMessage.texts={"de":"Okay."}',
      );
    });

    it("lists the wait settings from the flat API shape", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          languageId: {
            autoSwitch: {
              waitAudio: "first_utterance",
              waitMessageMode: "off",
              waitMessageSkipWhenReady: false,
              waitMessageTexts: '{"en":"Hi."}',
            },
          },
        },
      });
      await runProjectsVoiceAdvancedList({});
      expect(console.log).toHaveBeenCalledWith(
        "languageId.autoSwitch.waitAudio=first_utterance",
      );
      expect(console.log).toHaveBeenCalledWith(
        "languageId.autoSwitch.waitMessage.mode=off",
      );
      expect(console.log).toHaveBeenCalledWith(
        "languageId.autoSwitch.waitMessage.skipWhenReady=false",
      );
      expect(console.log).toHaveBeenCalledWith(
        'languageId.autoSwitch.waitMessage.texts={"en":"Hi."}',
      );
    });
  });

  it("resets advanced settings", async () => {
    resetProjectVoiceAdvancedSettings.mockResolvedValue({
      project_id: "proj-1",
      settings: { vad: { gateStt: true }, events: { mode: "both" } },
    });

    await runProjectsVoiceAdvancedReset({});

    expect(resetProjectVoiceAdvancedSettings).toHaveBeenCalledWith("proj-1");
    expect(console.log).toHaveBeenCalledWith("reset=defaults");
  });
});
