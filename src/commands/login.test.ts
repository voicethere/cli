import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runLogin } from "./login.js";

describe("runLogin", () => {
  let credentialsPath: string;

  beforeEach(async () => {
    const dir = join(tmpdir(), `voicethere-cli-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    credentialsPath = join(dir, "credentials.json");
    process.env.VOICETHERE_CREDENTIALS_PATH = credentialsPath;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    delete process.env.VOICETHERE_CREDENTIALS_PATH;
    delete process.env.VOICETHERE_USER_API_KEY;
    await rm(dirname(credentialsPath), { recursive: true, force: true });
  });

  it("stores org key and user API key", async () => {
    await runLogin({
      apiKey: "vth_org_key",
      apiBase: "https://app.voicethere.dev/api/v1",
      userApiKey: "vthu_personal_key",
    });

    const raw = await readFile(credentialsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      api_key: string;
      user_api_key?: string;
      api_base: string;
    };
    expect(parsed.api_key).toBe("vth_org_key");
    expect(parsed.user_api_key).toBe("vthu_personal_key");
    expect(parsed.api_base).toBe("https://app.voicethere.dev/api/v1");
  });

  it("preserves active_org_id when re-logging in", async () => {
    await runLogin({
      apiKey: "vth_org_key",
      userApiKey: "vthu_personal_key",
    });

    const raw1 = await readFile(credentialsPath, "utf8");
    const withOrg = {
      ...JSON.parse(raw1),
      active_org_id: "org-abc",
    };
    await writeFile(
      credentialsPath,
      `${JSON.stringify(withOrg, null, 2)}\n`,
      "utf8",
    );

    await runLogin({
      apiKey: "vth_new_org_key",
      userApiKey: "vthu_personal_key",
    });

    const parsed = JSON.parse(await readFile(credentialsPath, "utf8")) as {
      api_key: string;
      active_org_id?: string;
    };
    expect(parsed.api_key).toBe("vth_new_org_key");
    expect(parsed.active_org_id).toBe("org-abc");
  });
});
