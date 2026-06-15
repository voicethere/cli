import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsSettingsList } from "./list.js";
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
          warm_pool_enabled: false,
          idle_scale_down_seconds: 600,
        },
      });

      await runProjectsSettingsList({});

      expect(listProjectSettings).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("warm_pool_enabled=false");
      expect(console.log).toHaveBeenCalledWith("idle_scale_down_seconds=600");
    });

    it("uses explicit project id over linked config", async () => {
      listProjectSettings.mockResolvedValue({
        project_id: "proj-2",
        settings: {
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
    it("sets a boolean setting and prints JSON", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
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
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify(
          { warm_pool_enabled: true, idle_scale_down_seconds: 600 },
          null,
          2,
        ),
      );
    });

    it("sets a numeric setting", async () => {
      setProjectSetting.mockResolvedValue({
        project_id: "proj-1",
        settings: {
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
    });

    it("rejects unknown setting names", async () => {
      await expect(
        runProjectsSettingsSet({ name: "unknown", value: "1" }),
      ).rejects.toThrow(/Unknown setting/);
      expect(setProjectSetting).not.toHaveBeenCalled();
    });

    it("rejects invalid boolean values", async () => {
      await expect(
        runProjectsSettingsSet({ name: "warm_pool_enabled", value: "maybe" }),
      ).rejects.toThrow(/Invalid boolean/);
    });
  });
});
