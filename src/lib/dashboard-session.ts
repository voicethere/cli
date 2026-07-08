import {
  DEFAULT_API_BASE,
  readCredentials,
  type Credentials,
} from "./config.js";

export type DashboardSession = Pick<Credentials, "api_base"> & {
  cookie: string;
};

export async function requireDashboardSession(): Promise<DashboardSession> {
  const fromEnv = process.env.VOICETHERE_DASHBOARD_COOKIE?.trim();
  const credentials = await readCredentials();
  const cookie =
    fromEnv || credentials?.dashboard_session_cookie?.trim() || "";
  if (!cookie) {
    throw new Error(
      [
        "Dashboard session required for org and account commands.",
        "After signing in at the app, copy your browser Cookie header, then run:",
        "  voicethere login --api-key <key> --dashboard-cookie '<cookie>'",
        "Or set VOICETHERE_DASHBOARD_COOKIE.",
      ].join("\n"),
    );
  }

  return {
    api_base: credentials?.api_base?.trim() || DEFAULT_API_BASE,
    cookie,
  };
}
