import { logCommandInfo, logStep } from "../lib/command-log.js";
import {
  DEFAULT_API_BASE,
  getCredentialsPath,
  readCredentials,
  writeCredentials,
} from "../lib/config.js";

export interface LoginOptions {
  apiKey: string;
  apiBase?: string;
  userApiKey?: string;
  dashboardCookie?: string;
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("--api-key is required");
  }

  const apiBase = (options.apiBase?.trim() || DEFAULT_API_BASE).replace(
    /\/$/,
    "",
  );

  const credentialsPath = getCredentialsPath();
  const existing = await readCredentials();

  const userApiKey =
    options.userApiKey?.trim() ||
    process.env.VOICETHERE_USER_API_KEY?.trim() ||
    existing?.user_api_key;

  const dashboardCookie =
    options.dashboardCookie?.trim() ||
    process.env.VOICETHERE_DASHBOARD_COOKIE?.trim() ||
    existing?.dashboard_session_cookie;

  logStep("Saving API credentials");
  logCommandInfo(`credentials: ${credentialsPath}`);
  logCommandInfo(`api base: ${apiBase}`);
  if (userApiKey) {
    logCommandInfo("user API key: stored");
  }
  if (dashboardCookie) {
    logCommandInfo("dashboard session cookie: stored (legacy)");
  }

  await writeCredentials({
    api_key: apiKey,
    api_base: apiBase,
    user_api_key: userApiKey,
    active_org_id: existing?.active_org_id,
    dashboard_session_cookie: dashboardCookie,
  });

  console.log(`Saved credentials to ${credentialsPath} (api_base=${apiBase})`);
}
