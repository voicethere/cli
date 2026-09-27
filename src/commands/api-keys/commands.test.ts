import { beforeEach, describe, expect, it, vi } from "vitest";

import { runApiKeysCreate } from "./create.js";
import { runApiKeysList } from "./list.js";
import { runApiKeysRevoke } from "./revoke.js";

vi.mock("../../lib/config.js", () => ({
  requireCredentials: vi.fn(async () => ({
    api_key: "vth_test",
    api_base: "http://127.0.0.1:3000/api/v1",
  })),
}));

const listApiKeys = vi.fn();
const createApiKey = vi.fn();
const revokeApiKey = vi.fn();
const readProjectConfig = vi.fn();

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listApiKeys,
    createApiKey,
    revokeApiKey,
  })),
}));

vi.mock("../../lib/project-config.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/project-config.js")>();
  return {
    ...actual,
    readProjectConfig: (...args: unknown[]) => readProjectConfig(...args),
  };
});

describe("api-keys commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readProjectConfig.mockResolvedValue(null);
  });

  it("lists API keys", async () => {
    listApiKeys.mockResolvedValue({
      api_keys: [
        {
          id: "key-1",
          name: "CLI",
          kind: "admin",
          key_prefix: "vth_abc",
          project_id: null,
          project_name: null,
          created_at: "2026-01-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
          revoked_at: null,
          last_used_at: null,
        },
      ],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runApiKeysList();
    expect(listApiKeys).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("key-1"));
    logSpy.mockRestore();
  });

  it("creates admin API key", async () => {
    createApiKey.mockResolvedValue({
      id: "key-2",
      kind: "admin",
      api_key: "vth_secret",
      project_id: null,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runApiKeysCreate({ name: "Dev CLI" });
    expect(createApiKey).toHaveBeenCalledWith({
      name: "Dev CLI",
      kind: "admin",
      project_id: undefined,
      expires_in_days: undefined,
    });
    expect(logSpy).toHaveBeenCalledWith("vth_secret");
    expect(readProjectConfig).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("rejects --project-id on admin keys", async () => {
    await expect(
      runApiKeysCreate({
        name: "Dev CLI",
        projectId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("--project-id is only valid for client API keys");
    expect(createApiKey).not.toHaveBeenCalled();
    expect(readProjectConfig).not.toHaveBeenCalled();
  });

  it("creates a client API key for the linked project", async () => {
    readProjectConfig.mockResolvedValue({
      path: "/repo/.voicethere/config.json",
      config: { project_id: "22222222-2222-4222-8222-222222222222" },
    });
    createApiKey.mockResolvedValue({
      id: "key-client",
      kind: "client",
      api_key: "vthc_secret",
      project_id: "22222222-2222-4222-8222-222222222222",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await runApiKeysCreate({ name: "Widget", kind: "client" });
    expect(createApiKey).toHaveBeenCalledWith({
      name: "Widget",
      kind: "client",
      project_id: "22222222-2222-4222-8222-222222222222",
      expires_in_days: undefined,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("22222222-2222-4222-8222-222222222222"),
    );
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("lets --project-id override the linked project", async () => {
    readProjectConfig.mockResolvedValue({
      path: "/repo/.voicethere/config.json",
      config: { project_id: "22222222-2222-4222-8222-222222222222" },
    });
    createApiKey.mockResolvedValue({
      id: "key-override",
      kind: "client",
      api_key: "vthc_override",
      project_id: "33333333-3333-4333-8333-333333333333",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runApiKeysCreate({
      name: "Widget",
      kind: "client",
      projectId: "33333333-3333-4333-8333-333333333333",
    });
    expect(readProjectConfig).not.toHaveBeenCalled();
    expect(createApiKey).toHaveBeenCalledWith({
      name: "Widget",
      kind: "client",
      project_id: "33333333-3333-4333-8333-333333333333",
      expires_in_days: undefined,
    });
    logSpy.mockRestore();
  });

  it("rejects a client API key when no project is linked or passed", async () => {
    await expect(
      runApiKeysCreate({ name: "Widget", kind: "client" }),
    ).rejects.toThrow(/Pass --project-id/);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("revokes API key", async () => {
    revokeApiKey.mockResolvedValue({
      name: "Old",
      key_prefix: "vth_old",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runApiKeysRevoke({ id: "key-3" });
    expect(revokeApiKey).toHaveBeenCalledWith("key-3");
    logSpy.mockRestore();
  });
});
