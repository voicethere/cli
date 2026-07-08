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
  const dashboardCookie =
    options.dashboardCookie?.trim() || existing?.dashboard_session_cookie;

  logStep("Saving API credentials");
  logCommandInfo(`credentials: ${credentialsPath}`);
  logCommandInfo(`api base: ${apiBase}`);
  if (dashboardCookie) {
    logCommandInfo("dashboard session cookie: stored");
  }

  await writeCredentials({
    api_key: apiKey,
    api_base: apiBase,
    dashboard_session_cookie: dashboardCookie,
  });

  console.log(`Saved credentials to ${credentialsPath} (api_base=${apiBase})`);
}
