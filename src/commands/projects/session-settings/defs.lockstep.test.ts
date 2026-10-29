// Lockstep: the VoiceThere API keeps the same session-settings key list
// (control plane `src/lib/session/project-session-settings.ts`), and its CI
// compares that list with this file's `SESSION_SETTING_KEYS`. Add or remove a
// key on both sides in the same batch.
import { describe, expect, it } from "vitest";
import { SESSION_SETTING_DEFS, SESSION_SETTING_KEYS } from "./defs.js";

const FROZEN_KEYS = [
  "error_message",
  "idle_timeout_enabled",
  "idle_timeout_seconds",
  "data_only_idle_timeout_seconds",
  "idle_timeout_voice_activity",
  "idle_timeout_dc_inbound",
  "max_session_minutes",
  "max_session_close_reason",
  "stt_enabled",
  "conversation_history_enabled",
  "conversation_recording_enabled",
  "conversation_recording_metered_overage_enabled",
];

describe("session settings key list lockstep", () => {
  it("has no duplicate keys", () => {
    expect(new Set(SESSION_SETTING_KEYS).size).toBe(
      SESSION_SETTING_KEYS.length,
    );
  });

  it("every key has a definition", () => {
    for (const key of SESSION_SETTING_KEYS) {
      expect(SESSION_SETTING_DEFS[key], key).toBeDefined();
    }
  });

  it("every definition is listed in the keys", () => {
    for (const key of Object.keys(SESSION_SETTING_DEFS)) {
      expect(SESSION_SETTING_KEYS as readonly string[], key).toContain(key);
    }
  });

  it("matches the frozen list shared with the API", () => {
    expect([...SESSION_SETTING_KEYS]).toEqual(FROZEN_KEYS);
  });
});
