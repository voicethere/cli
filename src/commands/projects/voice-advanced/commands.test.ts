import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseVoiceAdvancedSettingValue,
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

  it("defaults follow the platform defs (lockstep)", () => {
    const d = VOICE_ADVANCED_SETTING_DEFS;
    expect(d["vad.minSilenceDurationMs"].default).toBe(1100);
    expect(d["vad.sttGateHoldMs"].default).toBe(400);
    expect(
      JSON.parse(String(d["languageId.autoSwitch.waitMessage.texts"].default)),
    ).toEqual({
      de: "Einen Moment bitte, ich wechsle auf {language}.",
      en: "One moment, switching to {language}.",
      es: "Un momento, por favor, cambio al {language}.",
      fr: "Un instant, je passe en {language}.",
      it: "Un momento, cambio lingua: {language}.",
      nl: "Een moment, ik schakel over naar het {language}.",
      pl: "Chwileczkę, przełączam na język: {language}.",
      pt: "Um momento, vou mudar para {language}.",
      ru: "Одну минуту, переключаюсь на {language}.",
    });
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
    expect(VOICE_ADVANCED_SETTING_KEYS).toHaveLength(49);
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

    await runProjectsVoiceAdvancedSet({
      name: "tts.phraseCache",
      value: "false",
    });
    expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
      "proj-1",
      "tts.phraseCache",
      false,
    );
    expect(console.log).toHaveBeenCalledWith("tts.phraseCache=false");

    await runProjectsVoiceAdvancedSet({
      name: "tts.phraseCache",
      value: "true",
    });
    expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
      "proj-1",
      "tts.phraseCache",
      true,
    );

    await expect(
      runProjectsVoiceAdvancedSet({ name: "tts.phraseCache", value: "maybe" }),
    ).rejects.toThrow(/Invalid boolean/);
  });

  describe("speaker gate and adaptive VAD", () => {
    const parse = parseVoiceAdvancedSettingValue;

    it("parses valid values", () => {
      expect(parse("speakerGate.mode", "auto")).toBe("auto");
      expect(parse("speakerGate.mode", "manual")).toBe("manual");
      expect(parse("speakerGate.mode", "disabled")).toBe("disabled");
      expect(parse("speakerGate.bargeIn", "anyone")).toBe("anyone");
      expect(parse("speakerGate.bargeIn", "caller_only")).toBe("caller_only");
      expect(parse("speakerGate.suppressShortBargeIn", "true")).toBe(true);
      expect(parse("vad.provider", "adaptive")).toBe("adaptive");
      expect(parse("vad.adaptive.noiseMarginDb", "8")).toBe(8);
      expect(parse("vad.adaptive.noiseMarginDb", "7.5")).toBe(7.5);
      expect(parse("vad.adaptive.noiseMarginDb", "0")).toBe(0);
      expect(parse("vad.adaptive.noiseMarginDb", "30")).toBe(30);
      expect(parse("vad.adaptive.useSpeechLevel", "false")).toBe(false);
      expect(parse("vad.adaptive.stuckActiveMs", "1000")).toBe(1000);
      expect(parse("vad.adaptive.stuckActiveMs", "60000")).toBe(60000);
    });

    it("rejects invalid values", () => {
      expect(() => parse("speakerGate.mode", "bogus")).toThrow(
        /must be one of: disabled, auto, manual/,
      );
      expect(() => parse("speakerGate.bargeIn", "nobody")).toThrow(
        /must be one of: caller_only, anyone/,
      );
      expect(() => parse("speakerGate.suppressShortBargeIn", "maybe")).toThrow(
        /Invalid boolean/,
      );
      expect(() => parse("vad.adaptive.useSpeechLevel", "maybe")).toThrow(
        /Invalid boolean/,
      );
      expect(() => parse("vad.adaptive.noiseMarginDb", "31")).toThrow(
        /between 0 and 30/,
      );
      expect(() => parse("vad.adaptive.noiseMarginDb", "-1")).toThrow(
        /between 0 and 30/,
      );
      expect(() => parse("vad.adaptive.stuckActiveMs", "999")).toThrow(
        /between 1000 and 60000/,
      );
      expect(() => parse("vad.adaptive.stuckActiveMs", "60001")).toThrow(
        /between 1000 and 60000/,
      );
    });

    it("set sends the dotted key and typed value", async () => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({ settings: {} });
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.mode",
        value: "auto",
      });
      await runProjectsVoiceAdvancedSet({
        name: "vad.adaptive.noiseMarginDb",
        value: "8",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenNthCalledWith(
        1,
        "proj-1",
        "speakerGate.mode",
        "auto",
      );
      expect(setProjectVoiceAdvancedSetting).toHaveBeenNthCalledWith(
        2,
        "proj-1",
        "vad.adaptive.noiseMarginDb",
        8,
      );
    });

    it("list prints every new key from the nested API shape", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {
          speakerGate: {
            mode: "auto",
            bargeIn: "caller_only",
            suppressShortBargeIn: false,
          },
          vad: {
            provider: "adaptive",
            adaptive: {
              noiseMarginDb: 8,
              useSpeechLevel: true,
              stuckActiveMs: 8000,
            },
          },
        },
      });
      await runProjectsVoiceAdvancedList({});
      const lines = (
        console.log as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.map((c) => String(c[0]));
      for (const line of [
        "speakerGate.mode=auto",
        "speakerGate.bargeIn=caller_only",
        "speakerGate.suppressShortBargeIn=false",
        "vad.provider=adaptive",
        "vad.adaptive.noiseMarginDb=8",
        "vad.adaptive.useSpeechLevel=true",
        "vad.adaptive.stuckActiveMs=8000",
      ]) {
        expect(lines).toContain(line);
      }
    });
  });

  describe("vad.provider", () => {
    it("vad.provider rejects silero", () => {
      expect(() =>
        parseVoiceAdvancedSettingValue("vad.provider", "silero"),
      ).toThrow(/must be one of: energy, adaptive/);
    });

    it("vad.provider accepts energy", () => {
      expect(parseVoiceAdvancedSettingValue("vad.provider", "energy")).toBe(
        "energy",
      );
    });
  });

  describe("tts.sentenceCase", () => {
    it("is a string enum auto|off that defaults to auto", () => {
      expect(VOICE_ADVANCED_SETTING_KEYS).toContain("tts.sentenceCase");
      expect(VOICE_ADVANCED_SETTING_DEFS["tts.sentenceCase"]).toMatchObject({
        type: "string",
        enum: ["auto", "off"],
        default: "auto",
      });
    });

    it("appears in the list output with default auto", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: { tts: { sentenceCase: "auto" } },
      });

      await runProjectsVoiceAdvancedList({});

      expect(console.log).toHaveBeenCalledWith("tts.sentenceCase=auto");
    });

    it.each(["off", "auto"])("sets %s", async (value) => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });

      await runProjectsVoiceAdvancedSet({ name: "tts.sentenceCase", value });

      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        "tts.sentenceCase",
        value,
      );
      expect(console.log).toHaveBeenCalledWith(`tts.sentenceCase=${value}`);
    });

    it("rejects bogus", async () => {
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "tts.sentenceCase",
          value: "bogus",
        }),
      ).rejects.toThrow(/tts\.sentenceCase must be one of: auto, off/);
    });
  });

  describe("debug.ttsTextTrace", () => {
    it("is a boolean that defaults to off", () => {
      expect(VOICE_ADVANCED_SETTING_KEYS).toContain("debug.ttsTextTrace");
      expect(VOICE_ADVANCED_SETTING_DEFS["debug.ttsTextTrace"]).toMatchObject({
        type: "boolean",
        default: false,
      });
    });

    it.each([
      ["on", true],
      ["true", true],
      ["off", false],
      ["false", false],
    ])("set %s sends %s", async (value, expected) => {
      setProjectVoiceAdvancedSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {},
      });

      await runProjectsVoiceAdvancedSet({
        name: "debug.ttsTextTrace",
        value,
      });

      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        "debug.ttsTextTrace",
        expected,
      );
      expect(console.log).toHaveBeenCalledWith(
        `debug.ttsTextTrace=${String(expected)}`,
      );
    });

    it("rejects an invalid value", async () => {
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "debug.ttsTextTrace",
          value: "maybe",
        }),
      ).rejects.toThrow(/Invalid boolean/);
    });

    it("list shows on until when the API returns an end time", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          debug: {
            ttsTextTrace: true,
            ttsTextTraceUntil: "2026-10-17T08:00:00.000Z",
          },
        },
      });

      await runProjectsVoiceAdvancedList({});

      expect(console.log).toHaveBeenCalledWith(
        "debug.ttsTextTrace=true (on until 2026-10-17T08:00:00.000Z)",
      );
    });

    it("list shows plain off when the trace is off", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: { debug: { ttsTextTrace: false, ttsTextTraceUntil: null } },
      });

      await runProjectsVoiceAdvancedList({});

      expect(console.log).toHaveBeenCalledWith("debug.ttsTextTrace=false");
    });
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
