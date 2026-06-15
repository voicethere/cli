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

vi.mock("../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listApiKeys,
    createApiKey,
    revokeApiKey,
  })),
}));

describe("api-keys commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    logSpy.mockRestore();
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
