import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runProjectsWidgetDeploy,
  runProjectsWidgetSet,
  runProjectsWidgetShow,
  validateWidgetHexColor,
  validateWidgetPreset,
} from "./commands.js";

const getProjectWidget = vi.fn();
const updateProjectWidgetDraft = vi.fn();
const publishProjectWidget = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    getProjectWidget,
    updateProjectWidgetDraft,
    publishProjectWidget,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

const sampleWidgetResponse = {
  project_id: "proj-1",
  public_id: "w_pub123",
  draft: {
    v: 1 as const,
    preset: "pill-dark" as const,
    position: "bottom-right" as const,
    mode: "voice" as const,
  },
  published: null,
  published_revision: 0,
  publish_status: "idle" as const,
  publish_error: null,
  published_at: null,
  created_at: "2026-08-30T00:00:00.000Z",
  updated_at: "2026-08-30T00:00:00.000Z",
};

describe("projects widget commands", () => {
  beforeEach(() => {
    getProjectWidget.mockReset();
    updateProjectWidgetDraft.mockReset();
    publishProjectWidget.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsWidgetShow", () => {
    it("prints public_id and CDN URL", async () => {
      getProjectWidget.mockResolvedValue({
        ...sampleWidgetResponse,
        publish_status: "published",
        published_revision: 2,
      });

      await runProjectsWidgetShow({});

      expect(getProjectWidget).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("public_id: w_pub123");
      expect(console.log).toHaveBeenCalledWith(
        "  cdn_url: https://cdn.voicethere.dev/widgets/w_pub123/config.json",
      );
    });

    it("outputs JSON when --json is set", async () => {
      getProjectWidget.mockResolvedValue(sampleWidgetResponse);

      await runProjectsWidgetShow({ json: true });

      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify(sampleWidgetResponse, null, 2),
      );
    });
  });

  describe("runProjectsWidgetSet", () => {
    it("merges flags onto existing draft and PUTs full draft", async () => {
      getProjectWidget.mockResolvedValue(sampleWidgetResponse);
      updateProjectWidgetDraft.mockResolvedValue({
        ...sampleWidgetResponse,
        draft: {
          v: 1,
          preset: "pill-light",
          position: "bottom-left",
          mode: "chat",
          launcherLabel: "Chat",
        },
      });

      await runProjectsWidgetSet({
        preset: "pill-light",
        position: "bottom-left",
        mode: "chat",
        launcherLabel: "Chat",
      });

      expect(updateProjectWidgetDraft).toHaveBeenCalledWith("proj-1", {
        v: 1,
        preset: "pill-light",
        position: "bottom-left",
        mode: "chat",
        launcherLabel: "Chat",
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("preset=pill-light"),
      );
    });

    it("rejects unknown preset", async () => {
      await expect(
        runProjectsWidgetSet({ preset: "unknown-preset" }),
      ).rejects.toThrow(/Unknown widget preset/);
      expect(getProjectWidget).not.toHaveBeenCalled();
    });

    it("rejects bad hex colors", async () => {
      getProjectWidget.mockResolvedValue(sampleWidgetResponse);

      await expect(
        runProjectsWidgetSet({ themePrimary: "not-a-color" }),
      ).rejects.toThrow(/hex color/);
      expect(updateProjectWidgetDraft).not.toHaveBeenCalled();
    });

    it("rejects empty set (no flags)", async () => {
      await expect(runProjectsWidgetSet({})).rejects.toThrow(
        /at least one widget field/,
      );
      expect(getProjectWidget).not.toHaveBeenCalled();
    });
  });

  describe("validators", () => {
    it("accepts #RGB and #RRGGBB", () => {
      expect(validateWidgetHexColor("#abc", "--theme-primary")).toBe("#abc");
      expect(validateWidgetHexColor("#aabbcc", "--theme-primary")).toBe(
        "#aabbcc",
      );
    });

    it("rejects unknown presets", () => {
      expect(() => validateWidgetPreset("neon")).toThrow(
        /Unknown widget preset/,
      );
    });
  });

  describe("runProjectsWidgetDeploy", () => {
    it("calls publish once without --wait", async () => {
      publishProjectWidget.mockResolvedValue({
        ...sampleWidgetResponse,
        publish_status: "queued",
      });

      await runProjectsWidgetDeploy({});

      expect(publishProjectWidget).toHaveBeenCalledWith("proj-1");
      expect(getProjectWidget).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("public_id: w_pub123");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("voicethere projects widget show"),
      );
    });

    it("polls until published when --wait is set", async () => {
      publishProjectWidget.mockResolvedValue({
        ...sampleWidgetResponse,
        publish_status: "queued",
      });
      getProjectWidget
        .mockResolvedValueOnce({
          ...sampleWidgetResponse,
          publish_status: "publishing",
          published_revision: 0,
        })
        .mockResolvedValueOnce({
          ...sampleWidgetResponse,
          publish_status: "published",
          published_revision: 3,
        });

      await runProjectsWidgetDeploy({
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 5_000,
      });

      expect(publishProjectWidget).toHaveBeenCalledWith("proj-1");
      expect(getProjectWidget).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith("publish_status: published");
      expect(console.log).toHaveBeenCalledWith(
        "  cdn_url_immutable: https://cdn.voicethere.dev/widgets/w_pub123/r3.json",
      );
    });

    it("throws when publish fails after --wait", async () => {
      publishProjectWidget.mockResolvedValue({
        ...sampleWidgetResponse,
        publish_status: "queued",
      });
      getProjectWidget.mockResolvedValue({
        ...sampleWidgetResponse,
        publish_status: "failed",
        publish_error: "CDN upload failed",
      });

      await expect(
        runProjectsWidgetDeploy({
          wait: true,
          pollIntervalMs: 1,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/CDN upload failed/);
    });
  });
});
