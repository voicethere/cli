import { afterEach, describe, expect, it } from "vitest";
import {
  USER_ORG_ID_HEADER,
  buildControlPlaneAuthHeaders,
  createApiFromCredentials,
  selectControlPlaneBearer,
} from "./control-plane-auth.js";
import { resolveEffectiveCredentials } from "./config.js";

describe("selectControlPlaneBearer", () => {
  afterEach(() => {
    delete process.env.VOICETHERE_API_KEY;
    delete process.env.VOICETHERE_USER_API_KEY;
    delete process.env.VOICETHERE_ORG_ID;
    delete process.env.VOICETHERE_CREDENTIALS_PATH;
  });

  it("prefers legacy api_key over user_api_key", () => {
    const bearer = selectControlPlaneBearer({
      api_base: "https://app.voicethere.dev/api/v1",
      api_key: "vth_org",
      user_api_key: "vthu_user",
      active_org_id: "org-1",
    });
    expect(bearer).toEqual({
      token: "vth_org",
      kind: "legacy_api_key",
      orgId: undefined,
    });
  });

  it("uses api_key-only credentials for project commands", () => {
    const bearer = selectControlPlaneBearer({
      api_base: "https://app.voicethere.dev/api/v1",
      api_key: "vth_org_only",
    });
    expect(bearer).toEqual({
      token: "vth_org_only",
      kind: "legacy_api_key",
      orgId: undefined,
    });
    const api = createApiFromCredentials({
      api_base: "https://app.voicethere.dev/api/v1",
      api_key: "vthc_client_only",
    });
    expect(api).toBeTruthy();
  });

  it("uses VOICETHERE_API_KEY over file user_api_key for project APIs", async () => {
    process.env.VOICETHERE_API_KEY = "vth_from_env";
    process.env.VOICETHERE_CREDENTIALS_PATH =
      "/tmp/does-not-need-to-exist-vt.json";
    const effective = await resolveEffectiveCredentials();
    // No file — env alone must produce usable org-key credentials.
    expect(effective?.api_key).toBe("vth_from_env");
    expect(effective?.apiKeyFromEnv).toBe(true);
    const bearer = selectControlPlaneBearer(effective!);
    expect(bearer.token).toBe("vth_from_env");
    expect(bearer.kind).toBe("legacy_api_key");
  });

  it("uses user key with org id when no project key", () => {
    const bearer = selectControlPlaneBearer({
      api_base: "https://app.voicethere.dev/api/v1",
      user_api_key: "vthu_user",
      active_org_id: "org-9",
    });
    expect(bearer.kind).toBe("user_api_key");
    expect(bearer.token).toBe("vthu_user");
    expect(bearer.orgId).toBe("org-9");
  });

  it("builds Authorization and org header for vthu_", () => {
    const headers = buildControlPlaneAuthHeaders({
      token: "vthu_secret",
      kind: "user_api_key",
      orgId: "org-42",
    });
    expect(headers.Authorization).toBe("Bearer vthu_secret");
    expect(headers[USER_ORG_ID_HEADER]).toBe("org-42");
  });

  it("omits org header for legacy keys", () => {
    const headers = buildControlPlaneAuthHeaders({
      token: "vth_org",
      kind: "legacy_api_key",
    });
    expect(headers.Authorization).toBe("Bearer vth_org");
    expect(headers[USER_ORG_ID_HEADER]).toBeUndefined();
  });
});
