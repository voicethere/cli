import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_SETTING_KEYS, runProjectsSettingsList } from "./list.js";
import { runProjectsSettingsSet } from "./set.js";

const listProjectSettings = vi.fn();
const setProjectSetting = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectSettings,
    setProjectSetting,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects settings commands", () => {
  beforeEach(() => {
    listProjectSettings.mockReset();
    setProjectSetting.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsSettingsList", () => {
    it("prints key=value lines for each setting", async () => {
      listProjectSettings.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          mode: "voice",
          warm_pool_enabled: false,
          redis_enabled: false,
          idle_scale_down_seconds: 600,
          data_only: false,
          shared_child_per_session: false,
          agent_crash_policy: "disconnect_all",
        },
      });

      await runProjectsSettingsList({});

      expect(listProjectSettings).toHaveBeenCalledWith("proj-1");
      for (const key of PROJECT_SETTING_KEYS) {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`^${key}=`)),
        );
      }
      expect(console.log).toHaveBeenCalledWith(
        "shared_child_per_session=false",
      );
      expect(console.log).toHaveBeenCalledWith(
        "agent_crash_policy=disconnect_all",
      );
    });

    it("uses explicit project id over linked config", async () => {
      listProjectSettings.mockResolvedValue({
        project_id: "proj-2",
        settings: {
          mode: "voice",
          warm_pool_enabled: true,
          idle_scale_down_seconds: 120,
        },
      });

      await runProjectsSettingsList({ projectId: "proj-2" });

      expect(requireProjectId).not.toHaveBeenCalled();
      expect(listProjectSettings).toHaveBeenCalledWith("proj-2");
    });
  });

  describe("runProjectsSettingsSet", () => {
    it("sets a boolean setting and prints key=value", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          mode: "voice",
          warm_pool_enabled: true,
          idle_scale_down_seconds: 600,
        },
      });

      await runProjectsSettingsSet({
        name: "warm_pool_enabled",
        value: "true",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "warm_pool_enabled",
        true,
      );
      expect(console.log).toHaveBeenCalledWith("warm_pool_enabled=true");
    });

    it("sets a numeric setting", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          mode: "voice",
          warm_pool_enabled: false,
          idle_scale_down_seconds: 300,
        },
      });

      await runProjectsSettingsSet({
        name: "idle_scale_down_seconds",
        value: "300",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "idle_scale_down_seconds",
        300,
      );
      expect(console.log).toHaveBeenCalledWith("idle_scale_down_seconds=300");
    });

    it("rejects unknown setting names", async () => {
      await expect(
        runProjectsSettingsSet({ name: "unknown", value: "1" }),
      ).rejects.toThrow(/Unknown setting/);
      expect(setProjectSetting).not.toHaveBeenCalled();
    });

    it("sets redis_enabled boolean", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          redis_enabled: false,
        },
      });

      await runProjectsSettingsSet({
        name: "redis_enabled",
        value: "false",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "redis_enabled",
        false,
      );
    });

    it("rejects invalid boolean values", async () => {
      await expect(
        runProjectsSettingsSet({ name: "warm_pool_enabled", value: "maybe" }),
      ).rejects.toThrow(/Invalid boolean/);
    });

    it("sets shared_child_per_session boolean", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          shared_child_per_session: true,
        },
      });

      await runProjectsSettingsSet({
        name: "shared_child_per_session",
        value: "true",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "shared_child_per_session",
        true,
      );
    });

    it("sets agent_crash_policy enum", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          agent_crash_policy: "restart_child",
        },
      });

      await runProjectsSettingsSet({
        name: "agent_crash_policy",
        value: "restart_child",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "agent_crash_policy",
        "restart_child",
      );
    });

    it("rejects invalid agent_crash_policy values", async () => {
      await expect(
        runProjectsSettingsSet({
          name: "agent_crash_policy",
          value: "panic",
        }),
      ).rejects.toThrow(/Invalid agent_crash_policy/);
      expect(setProjectSetting).not.toHaveBeenCalled();
    });

    it("sets mode enum", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
          mode: "voice+data",
        },
      });

      await runProjectsSettingsSet({
        name: "mode",
        value: "voice+data",
      });

      expect(setProjectSetting).toHaveBeenCalledWith(
        "proj-1",
        "mode",
        "voice+data",
      );
    });

    it("rejects invalid mode values", async () => {
      await expect(
        runProjectsSettingsSet({
          name: "mode",
          value: "both",
        }),
      ).rejects.toThrow(/Invalid mode/);
      expect(setProjectSetting).not.toHaveBeenCalled();
    });
  });
});
