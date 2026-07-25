import { createApi, VoicethereApi } from "./api.js";
import {
  USER_ORG_ID_HEADER,
  isUserApiKeyToken,
} from "./auth-headers.js";
import type { Credentials } from "./config.js";
import { requireCredentials } from "./config.js";

export { USER_ORG_ID_HEADER };

export type ControlPlaneBearer = {
  token: string;
  /** Required for personal `vthu_` keys. */
  orgId?: string;
  kind: "legacy_api_key" | "user_api_key";
};

/**
 * Select Bearer credentials for project/control-plane calls.
 * Prefer org/project key (`VOICETHERE_API_KEY` / `api_key`) for automation;
 * otherwise use personal `vthu_` + active org.
 */
export function selectControlPlaneBearer(
  credentials: Credentials,
): ControlPlaneBearer {
  const apiKey = credentials.api_key?.trim();
  if (apiKey) {
    return {
      token: apiKey,
      kind: isUserApiKeyToken(apiKey) ? "user_api_key" : "legacy_api_key",
      orgId: isUserApiKeyToken(apiKey)
        ? credentials.active_org_id?.trim() || undefined
        : undefined,
    };
  }

  const userKey = credentials.user_api_key?.trim();
  if (userKey) {
    return {
      token: userKey,
      kind: "user_api_key",
      orgId: credentials.active_org_id?.trim() || undefined,
    };
  }

  throw new Error(
    "Not logged in. Run: voicethere login  (or: voicethere login --api-key <key>)",
  );
}

export function buildControlPlaneAuthHeaders(
  bearer: ControlPlaneBearer,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer.token}`,
  };
  if (bearer.kind === "user_api_key" || isUserApiKeyToken(bearer.token)) {
    if (bearer.orgId) {
      headers[USER_ORG_ID_HEADER] = bearer.orgId;
    }
  }
  return headers;
}

export function createApiFromCredentials(
  credentials: Credentials,
): VoicethereApi {
  const bearer = selectControlPlaneBearer(credentials);
  return createApi(bearer.token, credentials.api_base, {
    orgId: bearer.orgId,
  });
}

export async function requireControlPlaneApi(): Promise<VoicethereApi> {
  const credentials = await requireCredentials();
  return createApiFromCredentials(credentials);
}
