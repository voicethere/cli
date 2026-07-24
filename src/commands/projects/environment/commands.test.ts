import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsEnvironmentDelete } from "./delete.js";
import { runProjectsEnvironmentList } from "./list.js";
import { runProjectsEnvironmentUpsert } from "./upsert.js";
import { runProjectsEnvironmentView } from "./view.js";

const listProjectEnvironment = vi.fn();
const getProjectEnvironmentVariable = vi.fn();
const upsertProjectEnvironmentVariable = vi.fn();
const deleteProjectEnvironmentVariable = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectEnvironment,
    getProjectEnvironmentVariable,
    upsertProjectEnvironmentVariable,
    deleteProjectEnvironmentVariable,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects environment commands", () => {
  beforeEach(() => {
    listProjectEnvironment.mockReset();
    getProjectEnvironmentVariable.mockReset();
    upsertProjectEnvironmentVariable.mockReset();
    deleteProjectEnvironmentVariable.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsEnvironmentList", () => {
    it("prints key=value lines for each variable", async () => {
      listProjectEnvironment.mockResolvedValue({
        project_id: "proj-1",
        variables: [
          { key: "LOG_LEVEL", value: "debug" },
          { key: "REGION", value: "us-east" },
        ],
      });

      await runProjectsEnvironmentList({});

      expect(listProjectEnvironment).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("LOG_LEVEL=debug");
      expect(console.log).toHaveBeenCalledWith("REGION=us-east");
    });

    it("prints empty message when no variables exist", async () => {
      listProjectEnvironment.mockResolvedValue({
        project_id: "proj-1",
        variables: [],
      });

      await runProjectsEnvironmentList({});

      expect(console.log).toHaveBeenCalledWith("No environment variables.");
    });

    it("uses explicit project id over linked config", async () => {
      listProjectEnvironment.mockResolvedValue({
        project_id: "proj-2",
        variables: [],
      });

      await runProjectsEnvironmentList({ projectId: "proj-2" });

      expect(requireProjectId).not.toHaveBeenCalled();
      expect(listProjectEnvironment).toHaveBeenCalledWith("proj-2");
    });
  });

  describe("runProjectsEnvironmentView", () => {
    it("prints JSON for the requested key", async () => {
      getProjectEnvironmentVariable.mockResolvedValue({
        key: "LOG_LEVEL",
        value: "debug",
      });

      await runProjectsEnvironmentView({ key: "LOG_LEVEL" });

      expect(getProjectEnvironmentVariable).toHaveBeenCalledWith(
        "proj-1",
        "LOG_LEVEL",
      );
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ key: "LOG_LEVEL", value: "debug" }, null, 2),
      );
    });

    it("requires a non-empty key", async () => {
      await expect(runProjectsEnvironmentView({ key: "  " })).rejects.toThrow(
        /environment key is required/,
      );
      expect(getProjectEnvironmentVariable).not.toHaveBeenCalled();
    });
  });

  describe("runProjectsEnvironmentUpsert", () => {
    it("upserts and prints the saved entry", async () => {
      upsertProjectEnvironmentVariable.mockResolvedValue({
        key: "REGION",
        value: "us-east",
      });

      await runProjectsEnvironmentUpsert({
        key: "REGION",
        value: "us-east",
      });

      expect(upsertProjectEnvironmentVariable).toHaveBeenCalledWith(
        "proj-1",
        "REGION",
        "us-east",
      );
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ key: "REGION", value: "us-east" }, null, 2),
      );
    });

    it("rejects empty key and value", async () => {
      await expect(
        runProjectsEnvironmentUpsert({ key: "", value: "x" }),
      ).rejects.toThrow(/environment key is required/);
      await expect(
        runProjectsEnvironmentUpsert({ key: "K", value: "   " }),
      ).rejects.toThrow(/environment value is required/);
      expect(upsertProjectEnvironmentVariable).not.toHaveBeenCalled();
    });
  });

  describe("runProjectsEnvironmentDelete", () => {
    it("deletes the variable and confirms on stdout", async () => {
      await runProjectsEnvironmentDelete({ key: "OLD_KEY" });

      expect(deleteProjectEnvironmentVariable).toHaveBeenCalledWith(
        "proj-1",
        "OLD_KEY",
      );
      expect(console.log).toHaveBeenCalledWith("Deleted OLD_KEY");
    });

    it("requires a non-empty key", async () => {
      await expect(runProjectsEnvironmentDelete({ key: "  " })).rejects.toThrow(
        /environment key is required/,
      );
      expect(deleteProjectEnvironmentVariable).not.toHaveBeenCalled();
    });
  });
});
