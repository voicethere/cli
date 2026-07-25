import {
  DEFAULT_API_BASE,
  readCredentials,
  type Credentials,
} from "./config.js";

export type UserCommandAuth =
  | { kind: "user_api_key"; token: string; activeOrgId?: string }
  | { kind: "dashboard_cookie"; cookie: string };

export type UserCommandSession = Pick<Credentials, "api_base"> & {
  auth: UserCommandAuth;
};

export async function requireUserCommandSession(): Promise<UserCommandSession> {
  const credentials = await readCredentials();
  const api_base = credentials?.api_base?.trim() || DEFAULT_API_BASE;

  const userKey =
    process.env.VOICETHERE_USER_API_KEY?.trim() ||
    credentials?.user_api_key?.trim();
  if (userKey) {
    return {
      api_base,
      auth: {
        kind: "user_api_key",
        token: userKey,
        activeOrgId: credentials?.active_org_id?.trim() || undefined,
      },
    };
  }

  const cookie =
    process.env.VOICETHERE_DASHBOARD_COOKIE?.trim() ||
    credentials?.dashboard_session_cookie?.trim();
  if (cookie) {
    return {
      api_base,
      auth: { kind: "dashboard_cookie", cookie },
    };
  }

  throw new Error(
    [
      "User authentication required for org and account commands.",
      "Run: voicethere login",
      "Or set VOICETHERE_USER_API_KEY (and VOICETHERE_ORG_ID when required).",
      "",
      "Manual: voicethere login --user-api-key <vthu_…>",
      "Legacy: --dashboard-cookie <Cookie header>",
    ].join("\n"),
  );
}
