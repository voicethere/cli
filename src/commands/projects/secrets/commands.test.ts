import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsSecretsCreate } from "./create.js";
import { runProjectsSecretsDelete } from "./delete.js";
import { runProjectsSecretsList } from "./list.js";

const listProjectSecrets = vi.fn();
const createProjectSecret = vi.fn();
const deleteProjectSecret = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listProjectSecrets,
    createProjectSecret,
    deleteProjectSecret,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects secrets commands", () => {
  beforeEach(() => {
    listProjectSecrets.mockReset();
    createProjectSecret.mockReset();
    deleteProjectSecret.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsSecretsList", () => {
    it("prints name and masked value for each secret", async () => {
      listProjectSecrets.mockResolvedValue({
        project_id: "proj-1",
        secrets: [
          {
            name: "OPENAI_API_KEY",
            masked_value: "sk-***",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      await runProjectsSecretsList({});

      expect(listProjectSecrets).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("OPENAI_API_KEY\tsk-***");
    });

    it("prints empty message when no secrets exist", async () => {
      listProjectSecrets.mockResolvedValue({
        project_id: "proj-1",
        secrets: [],
      });

      await runProjectsSecretsList({});

      expect(console.log).toHaveBeenCalledWith("No secrets.");
    });
  });

  describe("runProjectsSecretsCreate", () => {
    it("creates a secret and prints JSON metadata", async () => {
      createProjectSecret.mockResolvedValue({
        name: "DB_PASSWORD",
        masked_value: "****",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });

      await runProjectsSecretsCreate({
        name: "DB_PASSWORD",
        value: "hunter2",
      });

      expect(createProjectSecret).toHaveBeenCalledWith(
        "proj-1",
        "DB_PASSWORD",
        "hunter2",
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"name": "DB_PASSWORD"'),
      );
    });

    it("rejects empty name and value", async () => {
      await expect(
        runProjectsSecretsCreate({ name: "", value: "x" }),
      ).rejects.toThrow(/secret name is required/);
      await expect(
        runProjectsSecretsCreate({ name: "X", value: "   " }),
      ).rejects.toThrow(/secret value is required/);
      expect(createProjectSecret).not.toHaveBeenCalled();
    });
  });

  describe("runProjectsSecretsDelete", () => {
    it("deletes the secret and confirms on stdout", async () => {
      await runProjectsSecretsDelete({ name: "OLD_SECRET" });

      expect(deleteProjectSecret).toHaveBeenCalledWith("proj-1", "OLD_SECRET");
      expect(console.log).toHaveBeenCalledWith("Deleted secret OLD_SECRET");
    });

    it("requires a non-empty name", async () => {
      await expect(
        runProjectsSecretsDelete({ name: "  " }),
      ).rejects.toThrow(/secret name is required/);
      expect(deleteProjectSecret).not.toHaveBeenCalled();
    });
  });
});
