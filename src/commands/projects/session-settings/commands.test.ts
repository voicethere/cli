import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsSessionSettingsList } from "./list.js";
import { runProjectsSessionSettingsSet } from "./set.js";

const listProjectSessionSettings = vi.fn();
const setProjectSessionSetting = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectSessionSettings,
    setProjectSessionSetting,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects session-settings commands", () => {
  beforeEach(() => {
    listProjectSessionSettings.mockReset();
    setProjectSessionSetting.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsSessionSettingsList", () => {
    it("prints key=value lines for each setting", async () => {
      listProjectSessionSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          idle_timeout_enabled: true,
          idle_timeout_seconds: 30,
          conversation_history_enabled: true,
        },
      });

      await runProjectsSessionSettingsList({});

      expect(listProjectSessionSettings).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("idle_timeout_enabled=true");
      expect(console.log).toHaveBeenCalledWith("idle_timeout_seconds=30");
      expect(console.log).toHaveBeenCalledWith(
        "conversation_history_enabled=true",
      );
    });

    it("uses explicit project id over linked config", async () => {
      listProjectSessionSettings.mockResolvedValue({
        project_id: "proj-2",
        settings: { idle_timeout_seconds: 90 },
      });

      await runProjectsSessionSettingsList({ projectId: "proj-2" });

      expect(requireProjectId).not.toHaveBeenCalled();
      expect(listProjectSessionSettings).toHaveBeenCalledWith("proj-2");
    });
  });

  describe("runProjectsSessionSettingsSet", () => {
    it("sets a numeric setting and prints key=value", async () => {
      setProjectSessionSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          idle_timeout_seconds: 90,
        },
      });

      await runProjectsSessionSettingsSet({
        name: "idle_timeout_seconds",
        value: "90",
      });

      expect(setProjectSessionSetting).toHaveBeenCalledWith(
        "proj-1",
        "idle_timeout_seconds",
        90,
      );
      expect(console.log).toHaveBeenCalledWith("idle_timeout_seconds=90");
    });

    it("sets a boolean setting", async () => {
      setProjectSessionSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: { idle_timeout_enabled: false },
      });

      await runProjectsSessionSettingsSet({
        name: "idle_timeout_enabled",
        value: "false",
      });

      expect(setProjectSessionSetting).toHaveBeenCalledWith(
        "proj-1",
        "idle_timeout_enabled",
        false,
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("billable"),
      );
    });

    it("sets conversation_history_enabled", async () => {
      setProjectSessionSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: { conversation_history_enabled: false },
      });

      await runProjectsSessionSettingsSet({
        name: "conversation_history_enabled",
        value: "false",
      });

      expect(setProjectSessionSetting).toHaveBeenCalledWith(
        "proj-1",
        "conversation_history_enabled",
        false,
      );
    });

    it("sets conversation_recording_enabled", async () => {
      setProjectSessionSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: { conversation_recording_enabled: true },
      });

      await runProjectsSessionSettingsSet({
        name: "conversation_recording_enabled",
        value: "true",
      });

      expect(setProjectSessionSetting).toHaveBeenCalledWith(
        "proj-1",
        "conversation_recording_enabled",
        true,
      );
    });

    it("sets conversation_recording_metered_overage_enabled", async () => {
      setProjectSessionSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: { conversation_recording_metered_overage_enabled: true },
      });

      await runProjectsSessionSettingsSet({
        name: "conversation_recording_metered_overage_enabled",
        value: "true",
      });

      expect(setProjectSessionSetting).toHaveBeenCalledWith(
        "proj-1",
        "conversation_recording_metered_overage_enabled",
        true,
      );
    });

    it("rejects unknown setting names", async () => {
      await expect(
        runProjectsSessionSettingsSet({ name: "unknown", value: "1" }),
      ).rejects.toThrow(/Unknown session setting/);
      expect(setProjectSessionSetting).not.toHaveBeenCalled();
    });

    it("rejects idle timeout below minimum seconds", async () => {
      await expect(
        runProjectsSessionSettingsSet({
          name: "idle_timeout_seconds",
          value: "10",
        }),
      ).rejects.toThrow(/between 30 and 86400/);
    });
  });
});
