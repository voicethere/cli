import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceAdvancedDefinition } from "../../../lib/api.js";
import {
  fallbackDefinition,
  formatVoiceAdvancedSettingsGroupHelp,
  parseVoiceAdvancedValue,
  resolveDefinitions,
} from "./definitions.js";
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

function def(
  partial: Partial<VoiceAdvancedDefinition> &
    Pick<VoiceAdvancedDefinition, "key" | "type" | "default">,
): VoiceAdvancedDefinition {
  return {
    path: partial.key.split("."),
    label: partial.key,
    description: `About ${partial.key}`,
    engineKey: null,
    ...partial,
  };
}

const DEFINITIONS: VoiceAdvancedDefinition[] = [
  def({
    key: "vad.threshold",
    type: "number",
    default: 0.05,
    engineKey: "vad.threshold",
  }),
  def({
    key: "vad.minSpeechDurationMs",
    type: "number",
    default: 200,
    engineKey: "vad.minSpeechDurationMs",
  }),
  def({
    key: "vad.provider",
    type: "string",
    default: "energy",
    enum: ["energy", "adaptive"],
    engineKey: "vad.provider",
  }),
  def({
    key: "vad.gateStt",
    type: "boolean",
    default: true,
    engineKey: "vad.gateStt",
  }),
  def({
    key: "vad.adaptive.stuckActiveMs",
    type: "number",
    default: 8000,
    min: 1000,
    max: 60000,
    engineKey: "vad.adaptive.stuckActiveMs",
  }),
  def({
    key: "vad.adaptive.noiseMarginDb",
    type: "number",
    default: 6,
    engineKey: "vad.adaptive.noiseMarginDb",
  }),
  def({
    key: "tts.speed",
    type: "number",
    default: 0.9,
    integer: false,
    min: 0.2,
    max: 2,
  }),
  def({ key: "tts.phraseCache", type: "boolean", default: true }),
  def({
    key: "speakerGate.splitOnSpeakerChange",
    type: "boolean",
    default: false,
    engineKey: "speakerGate.splitOnSpeakerChange",
  }),
  def({
    key: "speakerGate.recheckOnOther",
    type: "boolean",
    default: true,
    engineKey: "speakerGate.recheckOnOther",
  }),
  def({
    key: "speakerGate.recheckMaxWindows",
    type: "number",
    default: 12,
    min: 1,
    max: 24,
    engineKey: "speakerGate.recheckMaxWindows",
  }),
  def({
    key: "speakerGate.threshold",
    type: "number",
    default: 0.459,
    integer: false,
    min: 0.2,
    max: 0.8,
    engineKey: "speakerGate.threshold",
  }),
  def({
    key: "speakerGate.enrollSpeechMs",
    type: "number",
    default: 3000,
    min: 1500,
    max: 10000,
    engineKey: "speakerGate.enrollSpeechMs",
  }),
  def({
    key: "speakerGate.checkSpeechMs",
    type: "number",
    default: 1500,
    min: 1000,
    max: 5000,
    engineKey: "speakerGate.checkSpeechMs",
  }),
  def({
    key: "speakerGate.minCheckSpeechMs",
    type: "number",
    default: 1500,
    min: 1000,
    max: 5000,
    engineKey: "speakerGate.minCheckSpeechMs",
  }),
  def({ key: "voice.profilesByLanguage", type: "string", default: "{}" }),
];

function resolve(key: string) {
  const found = resolveDefinitions({ definitions: DEFINITIONS }).find(
    (d) => d.key === key,
  );
  if (!found) {
    throw new Error(`fixture has no ${key}`);
  }
  return found;
}

describe("projects voice-advanced", () => {
  beforeEach(() => {
    listProjectVoiceAdvancedSettings.mockReset();
    setProjectVoiceAdvancedSetting.mockReset();
    resetProjectVoiceAdvancedSettings.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("parseVoiceAdvancedValue with API definitions", () => {
    it("accepts a valid value of each type", () => {
      expect(parseVoiceAdvancedValue(resolve("vad.gateStt"), "off")).toBe(
        false,
      );
      expect(parseVoiceAdvancedValue(resolve("vad.gateStt"), "Yes")).toBe(true);
      expect(parseVoiceAdvancedValue(resolve("vad.threshold"), "0.3")).toBe(
        0.3,
      );
      expect(
        parseVoiceAdvancedValue(resolve("vad.minSpeechDurationMs"), "300"),
      ).toBe(300);
      expect(parseVoiceAdvancedValue(resolve("vad.provider"), "adaptive")).toBe(
        "adaptive",
      );
      expect(parseVoiceAdvancedValue(resolve("tts.speed"), "0.9")).toBe(0.9);
      expect(
        parseVoiceAdvancedValue(
          resolve("voice.profilesByLanguage"),
          ' {"de":{"stt":"de"}} ',
        ),
      ).toBe('{"de":{"stt":"de"}}');
    });

    it("rejects a non-number", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.threshold"), "abc"),
      ).toThrow(/Invalid number/);
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.threshold"), ""),
      ).toThrow(/Invalid number/);
    });

    it("rejects a fraction on an integer key", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.minSpeechDurationMs"), "200.5"),
      ).toThrow(/must be an integer/);
    });

    it("rejects an invalid boolean", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.gateStt"), "maybe"),
      ).toThrow(/Invalid boolean/);
    });

    it("rejects an enum value the API does not offer (silero) while the engine knows it", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.provider"), "silero"),
      ).toThrow(/must be one of: energy, adaptive/);
    });

    it("rejects a value above the API cap but inside the engine range", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.adaptive.stuckActiveMs"), "60001"),
      ).toThrow(/between 1000 and 60000/);
    });

    it("rejects a value outside the engine range that has no API cap", () => {
      expect(() =>
        parseVoiceAdvancedValue(resolve("vad.adaptive.noiseMarginDb"), "31"),
      ).toThrow(/engine range/);
    });

    it("prints one warning when the API disagrees with the catalog and uses the catalog", () => {
      const resolved = resolveDefinitions({
        definitions: [
          def({
            key: "vad.minSpeechDurationMs",
            type: "number",
            default: 200,
            integer: false,
            engineKey: "vad.minSpeechDurationMs",
          }),
        ],
      })[0];
      const warnings = vi
        .mocked(console.error)
        .mock.calls.filter((c) => String(c[0]).includes("warning"));
      expect(warnings).toHaveLength(1);
      expect(String(warnings[0][0])).toContain("vad.minSpeechDurationMs");
      expect(resolved.integer).toBe(true);
    });
  });

  describe("set", () => {
    it("sends the typed value for a key from definitions", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {},
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedSet({
        name: "vad.threshold",
        value: "0.2",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "vad.threshold",
        0.2,
      );
      expect(console.log).toHaveBeenCalledWith("vad.threshold=0.2");
    });

    it("lists the valid keys for an unknown key and sends nothing", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {},
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({ name: "vad.nope", value: "1" }),
      ).rejects.toThrow(
        /Unknown voice advanced setting vad\.nope\. Valid: vad\.threshold, /,
      );
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
    });

    it("does not send an invalid value", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {},
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({ name: "vad.provider", value: "silero" }),
      ).rejects.toThrow(/must be one of/);
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
    });
  });

  describe("speakerGate keys", () => {
    const gateSettings = (over: Record<string, unknown> = {}) => ({
      speakerGate: {
        mode: "disabled",
        splitOnSpeakerChange: false,
        recheckOnOther: true,
        recheckMaxWindows: 12,
        threshold: 0.459,
        enrollSpeechMs: 3000,
        checkSpeechMs: 1500,
        minCheckSpeechMs: 1500,
        ...over,
      },
    });

    it("list prints all 7 speakerGate keys with defaults, threshold range open-ended", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings(),
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedList();
      const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
      for (const k of [
        "splitOnSpeakerChange",
        "recheckMaxWindows",
        "recheckOnOther",
        "threshold",
        "enrollSpeechMs",
        "checkSpeechMs",
        "minCheckSpeechMs",
      ]) {
        expect(lines.some((l) => l.startsWith(`speakerGate.${k}=`))).toBe(true);
      }
      expect(lines).toContain(
        "speakerGate.threshold=0.459  (default 0.459 [0.2–0.8])",
      );
    });

    it("threshold 1 fails the engine range (exclusive), 0 too, 0.85 fails the API cap", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings(),
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.threshold",
          value: "1",
        }),
      ).rejects.toThrow(/engine range/);
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.threshold",
          value: "0",
        }),
      ).rejects.toThrow(/engine range/);
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.threshold",
          value: "0.85",
        }),
      ).rejects.toThrow(/between 0\.2 and 0\.8$/);
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.threshold",
        value: "0.5",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "speakerGate.threshold",
        0.5,
      );
    });

    it("R1: splitOnSpeakerChange true with recheckMaxWindows 1 is rejected locally with the engine message", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings({ recheckMaxWindows: 1, recheckOnOther: false }),
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.splitOnSpeakerChange",
          value: "true",
        }),
      ).rejects.toThrow(/recheckMaxWindows must be 0 \(no cap\) or at least 2/);
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
    });

    it("R1 applies in mode disabled, and from the recheckMaxWindows side", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings({ mode: "disabled" }),
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.recheckMaxWindows",
          value: "1",
        }),
      ).rejects.toThrow(/at least 2/);
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
    });

    it("R1 allows 1 window once both rechecks are off, and 2 with the split on", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings({
          recheckOnOther: false,
          splitOnSpeakerChange: false,
        }),
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.recheckMaxWindows",
        value: "1",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledTimes(1);
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings({ splitOnSpeakerChange: true }),
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.recheckMaxWindows",
        value: "2",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledTimes(2);
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.recheckMaxWindows",
          value: "0",
        }),
      ).rejects.toThrow(/between 1 and 24/);
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledTimes(2);
    });

    it("R2: checkSpeechMs below minCheckSpeechMs is rejected, equal passes", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings(),
        definitions: DEFINITIONS,
      });
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.checkSpeechMs",
          value: "1000",
        }),
      ).rejects.toThrow(/checkSpeechMs must be at least .*minCheckSpeechMs/);
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.minCheckSpeechMs",
          value: "2000",
        }),
      ).rejects.toThrow(/checkSpeechMs must be at least/);
      expect(setProjectVoiceAdvancedSetting).not.toHaveBeenCalled();
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.checkSpeechMs",
        value: "1500",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledTimes(1);
    });

    it("an unrelated key is not blocked by an older broken combination", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings({ recheckMaxWindows: 1 }),
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.enrollSpeechMs",
        value: "4000",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "speakerGate.enrollSpeechMs",
        4000,
      );
    });

    it("a server 400 is shown as is", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: gateSettings(),
        definitions: DEFINITIONS,
      });
      setProjectVoiceAdvancedSetting.mockRejectedValue(
        new Error("HTTP 400: speakerGate.threshold is not allowed on this plan"),
      );
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.threshold",
          value: "0.5",
        }),
      ).rejects.toThrow(
        /HTTP 400: speakerGate\.threshold is not allowed on this plan/,
      );
    });

    it("fallback path (no definitions) sends booleans and numbers, keeps the exclusive range and R1", async () => {
      const response = {
        settings: gateSettings({ recheckMaxWindows: 1, recheckOnOther: false }),
        defaults: gateSettings(),
      };
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.recheckOnOther",
        value: "false",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        "speakerGate.recheckOnOther",
        false,
      );
      await runProjectsVoiceAdvancedSet({
        name: "speakerGate.threshold",
        value: "0.6",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenLastCalledWith(
        "proj-1",
        "speakerGate.threshold",
        0.6,
      );
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.threshold",
          value: "1",
        }),
      ).rejects.toThrow(/engine range/);
      await expect(
        runProjectsVoiceAdvancedSet({
          name: "speakerGate.splitOnSpeakerChange",
          value: "true",
        }),
      ).rejects.toThrow(/at least 2/);
    });
  });

  describe("set against a platform without definitions", () => {
    const response = {
      settings: {
        vad: { gateStt: true, sampleRate: 16000 },
        tts: { speed: 0.9 },
      },
      defaults: {
        vad: { gateStt: true, sampleRate: 16000 },
        tts: { speed: 0.9 },
      },
    };

    it("sends a boolean for vad.gateStt, typed from defaults", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      await runProjectsVoiceAdvancedSet({
        name: "vad.gateStt",
        value: "false",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "vad.gateStt",
        false,
      );
    });

    it("sends a string for vad.sampleRate", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      await runProjectsVoiceAdvancedSet({
        name: "vad.sampleRate",
        value: "8000",
      });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "vad.sampleRate",
        "8000",
      );
    });

    it("sends a fractional number for a key the catalog does not know", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      await runProjectsVoiceAdvancedSet({ name: "tts.speed", value: "0.85" });
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "tts.speed",
        0.85,
      );
    });

    it("still applies the engine facts of a catalog key", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      await expect(
        runProjectsVoiceAdvancedSet({ name: "vad.sampleRate", value: "44100" }),
      ).rejects.toThrow(/must be one of: 8000, 16000/);
    });

    it("sends an unknown key as text and shows the server's 400", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue(response);
      setProjectVoiceAdvancedSetting.mockRejectedValue(
        new Error("HTTP 400: unknown key vad.nope"),
      );
      await expect(
        runProjectsVoiceAdvancedSet({ name: "vad.nope", value: "1" }),
      ).rejects.toThrow(/HTTP 400: unknown key vad\.nope/);
      expect(setProjectVoiceAdvancedSetting).toHaveBeenCalledWith(
        "proj-1",
        "vad.nope",
        "1",
      );
    });

    it("reads the flat wait message path from defaults", () => {
      const d = fallbackDefinition("languageId.autoSwitch.waitMessage.mode", {
        settings: {},
        defaults: {
          languageId: { autoSwitch: { waitMessageMode: "immediate" } },
        },
      });
      expect(d.type).toBe("string");
    });
  });

  describe("list", () => {
    it("prints every key from definitions with its default", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {
          vad: {
            threshold: 0.07,
            minSpeechDurationMs: 200,
            provider: "energy",
            gateStt: true,
            adaptive: { stuckActiveMs: 8000, noiseMarginDb: 6 },
          },
          tts: { speed: 0.9, phraseCache: true },
          voice: { profilesByLanguage: "{}" },
        },
        definitions: DEFINITIONS,
      });
      await runProjectsVoiceAdvancedList();
      const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
      expect(lines).toHaveLength(DEFINITIONS.length);
      for (const d of DEFINITIONS) {
        expect(lines.some((l) => l.startsWith(`${d.key}=`))).toBe(true);
      }
      expect(lines).toContain("vad.threshold=0.07  (default 0.05)");
      expect(lines).toContain(
        "vad.adaptive.stuckActiveMs=8000  (default 8000 [1000–60000])",
      );
    });

    it("without definitions prints the keys found in settings, including the flat wait paths", async () => {
      listProjectVoiceAdvancedSettings.mockResolvedValue({
        settings: {
          vad: { gateStt: true },
          debug: {
            ttsTextTrace: true,
            ttsTextTraceUntil: "2026-11-08T12:00:00Z",
          },
          languageId: { autoSwitch: { waitMessageMode: "immediate" } },
        },
      });
      await runProjectsVoiceAdvancedList();
      const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
      expect(lines).toEqual([
        "vad.gateStt=true",
        "debug.ttsTextTrace=true (on until 2026-11-08T12:00:00Z)",
        "languageId.autoSwitch.waitMessage.mode=immediate",
      ]);
    });
  });

  it("help lists engine keys from the catalog and points to list", () => {
    const help = formatVoiceAdvancedSettingsGroupHelp();
    expect(help).toContain("vad.threshold (0.15)");
    expect(help).toContain("vad.provider (energy) [energy|adaptive|silero]");
    expect(help).toContain("voicethere projects voice-advanced list");
  });

  it("resets advanced settings", async () => {
    resetProjectVoiceAdvancedSettings.mockResolvedValue({ settings: {} });
    await runProjectsVoiceAdvancedReset();
    expect(resetProjectVoiceAdvancedSettings).toHaveBeenCalledWith("proj-1");
    expect(console.log).toHaveBeenCalledWith("reset=defaults");
  });
});
