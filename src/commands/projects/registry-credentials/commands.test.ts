import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRegistryCredentialsSet } from "./commands.js";

const putRegistryCredential = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({ putRegistryCredential })),
}));
vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));
vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects registry-credentials commands", () => {
  beforeEach(() => {
    putRegistryCredential.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("registry-credentials set reads the password from stdin and never from argv", async () => {
    putRegistryCredential.mockResolvedValue({});
    const stdin = Object.assign(Readable.from(["s3cret\n"]), { isTTY: false });

    await runRegistryCredentialsSet({
      name: "ghcr",
      host: "ghcr.io",
      username: "bot",
      passwordStdin: true,
      stdin,
    });

    expect(putRegistryCredential).toHaveBeenCalledWith("proj-1", "ghcr", {
      registryHost: "ghcr.io",
      username: "bot",
      password: "s3cret",
    });
    // Without --password-stdin there is no other source for the password.
    await expect(
      runRegistryCredentialsSet({
        name: "ghcr",
        host: "ghcr.io",
        username: "bot",
      }),
    ).rejects.toThrow("--password-stdin");
  });

  it("registry-credentials set refuses a TTY stdin", async () => {
    const stdin = Object.assign(Readable.from([]), { isTTY: true });

    await expect(
      runRegistryCredentialsSet({
        name: "ghcr",
        host: "ghcr.io",
        username: "bot",
        passwordStdin: true,
        stdin,
      }),
    ).rejects.toThrow("Pipe it in");
    expect(putRegistryCredential).not.toHaveBeenCalled();
  });
});
