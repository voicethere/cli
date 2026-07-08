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
      "Create a personal API key in Settings, then run:",
      "  voicethere login --api-key <org-key> --user-api-key <vthu_…>",
      "Or set VOICETHERE_USER_API_KEY.",
      "",
      "Legacy: copy your browser Cookie header and use --dashboard-cookie.",
    ].join("\n"),
  );
}
