import { ApiError } from "../lib/api.js";
import { logCommandInfo, logStep } from "../lib/command-log.js";
import {
  DEFAULT_API_BASE,
  getCredentialsPath,
  readCredentials,
  resolveEffectiveCredentials,
  writeCredentials,
  type Credentials,
} from "../lib/config.js";
import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import {
  DeviceLoginError,
  buildDeviceLoginMetadata,
  initiateDeviceAuthorization,
  waitForDeviceAuthorization,
} from "../lib/device-login.js";
import { emitLoginMachineLine } from "../lib/login-machine-output.js";
import { openBrowser, type OpenBrowserFn } from "../lib/open-browser.js";
import type { PollRuntime } from "../lib/poll-backoff.js";
import { readProjectConfig } from "../lib/project-config.js";
import { TOS_NOT_ACCEPTED_CODE } from "../lib/tos-gate.js";

export interface LoginOptions {
  apiKey?: string;
  apiBase?: string;
  userApiKey?: string;
  dashboardCookie?: string;
  force?: boolean;
  noOpen?: boolean;
  /** Injected by CLI registration from package.json. */
  cliVersion?: string;
  /** Test hooks */
  openBrowserFn?: OpenBrowserFn;
  pollRuntime?: PollRuntime;
  cwd?: string;
}

export type CredentialCheckDecision =
  | { action: "skip"; reason: string }
  | { action: "login"; reason: string; requestedProjectId?: string }
  | { action: "abort"; reason: string };

function normalizeApiBase(raw?: string): string {
  return (raw?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

/**
 * Browser login cannot override VOICETHERE_* env credentials. If those are set,
 * minting a file key is useless (and may hide a broken env key). Abort before
 * initiating device authorization.
 */
export function browserLoginBlockedByEnvCredentials(): string | null {
  const envApi = process.env.VOICETHERE_API_KEY?.trim();
  const envUser = process.env.VOICETHERE_USER_API_KEY?.trim();
  if (!envApi && !envUser) {
    return null;
  }
  const names = [
    envApi ? "VOICETHERE_API_KEY" : null,
    envUser ? "VOICETHERE_USER_API_KEY" : null,
  ]
    .filter((name): name is string => Boolean(name))
    .join(" and ");
  return (
    `Cannot complete browser login while ${names} is set. ` +
    "Environment credentials override the credentials file, so a newly saved personal key would not be used. " +
    `Unset ${names} (or fix the invalid key), then retry. ` +
    "For CI/automation use: voicethere login --api-key <key>"
  );
}

/** Whether an API failure should start browser login (vs abort). */
export function shouldInitiateLoginForApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.code === TOS_NOT_ACCEPTED_CODE) {
    return true;
  }
  return error.status === 401 || error.status === 403 || error.status === 404;
}

async function linkedProjectId(cwd?: string): Promise<string | undefined> {
  const linked = await readProjectConfig(cwd ?? process.cwd());
  return linked?.config.project_id;
}

export async function evaluateExistingCredentials(options: {
  force?: boolean;
  cwd?: string;
  apiBase?: string;
}): Promise<CredentialCheckDecision> {
  if (options.force) {
    return {
      action: "login",
      reason: "forced",
      requestedProjectId: await linkedProjectId(options.cwd),
    };
  }

  const effective = await resolveEffectiveCredentials();
  if (!effective) {
    return {
      action: "login",
      reason: "no_credentials",
      requestedProjectId: await linkedProjectId(options.cwd),
    };
  }

  if (options.apiBase?.trim()) {
    effective.api_base = normalizeApiBase(options.apiBase);
  }

  const api = createApiFromCredentials(effective);
  const linked = await readProjectConfig(options.cwd ?? process.cwd());

  try {
    if (linked) {
      await api.getProject(linked.config.project_id);
      return {
        action: "skip",
        reason: `linked project ${linked.config.project_id} is accessible`,
      };
    }

    await api.listProjects();
    return { action: "skip", reason: "credentials can list projects" };
  } catch (error) {
    if (shouldInitiateLoginForApiError(error)) {
      return {
        action: "login",
        reason:
          error instanceof ApiError
            ? `API ${error.status}${error.code ? ` (${error.code})` : ""}`
            : "auth_failed",
        requestedProjectId: linked?.config.project_id,
      };
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected credential check error";
    return {
      action: "abort",
      reason: `Could not validate credentials (${message}). Fix network/API errors, then retry. Use --force to skip this check.`,
    };
  }
}

async function runManualLogin(options: LoginOptions): Promise<void> {
  const apiKey = options.apiKey?.trim();
  const userApiKey = options.userApiKey?.trim();
  if (!apiKey && !userApiKey) {
    throw new Error(
      "Provide --api-key and/or --user-api-key for manual login, or run voicethere login for browser login.",
    );
  }

  const apiBase = normalizeApiBase(options.apiBase);
  const credentialsPath = getCredentialsPath();
  const existing = await readCredentials();

  const resolvedUserKey =
    userApiKey ||
    process.env.VOICETHERE_USER_API_KEY?.trim() ||
    existing?.user_api_key;

  const dashboardCookie = options.dashboardCookie?.trim();
  const explicitUserApiKey = Boolean(userApiKey);

  logStep("Saving API credentials");
  logCommandInfo(`credentials: ${credentialsPath}`);
  logCommandInfo(`api base: ${apiBase}`);
  if (apiKey) {
    logCommandInfo("org/project API key: stored");
  }
  if (resolvedUserKey) {
    logCommandInfo("user API key: stored");
  }
  if (dashboardCookie) {
    logCommandInfo("dashboard session cookie: stored (legacy)");
  }

  const next: Credentials = {
    api_base: apiBase,
    api_key: apiKey || existing?.api_key,
    user_api_key: resolvedUserKey,
    active_org_id: explicitUserApiKey ? undefined : existing?.active_org_id,
    dashboard_session_cookie:
      dashboardCookie || existing?.dashboard_session_cookie,
  };

  await writeCredentials(next);
  console.log(`Saved credentials to ${credentialsPath} (api_base=${apiBase})`);
}

async function runBrowserLogin(options: LoginOptions): Promise<void> {
  const apiBase = normalizeApiBase(
    options.apiBase || (await readCredentials())?.api_base,
  );
  const cliVersion = options.cliVersion?.trim() || "0.0.0";
  const metadata = buildDeviceLoginMetadata(cliVersion);
  const openFn = options.openBrowserFn ?? openBrowser;

  const decision = await evaluateExistingCredentials({
    force: options.force,
    cwd: options.cwd,
    apiBase: options.apiBase,
  });

  if (decision.action === "abort") {
    throw new Error(decision.reason);
  }
  if (decision.action === "skip") {
    logStep("Already logged in");
    logCommandInfo(decision.reason);
    emitLoginMachineLine("status", "already_logged_in");
    console.log(
      `Already logged in (${decision.reason}). Use --force to re-authenticate.`,
    );
    return;
  }

  const envBlock = browserLoginBlockedByEnvCredentials();
  if (envBlock) {
    throw new Error(envBlock);
  }

  logStep("Starting browser device login");
  logCommandInfo(`api base: ${apiBase}`);
  if (decision.requestedProjectId) {
    logCommandInfo(`requested project: ${decision.requestedProjectId}`);
  }

  const authorization = await initiateDeviceAuthorization(apiBase, {
    requestedProjectId: decision.requestedProjectId,
    metadata,
  });

  emitLoginMachineLine("status", "pending_approval");
  emitLoginMachineLine(
    "verification_uri_complete",
    authorization.verification_uri_complete,
  );
  emitLoginMachineLine("user_code", authorization.user_code);

  console.log("");
  console.log("Confirm this login in your browser:");
  console.log(`  ${authorization.verification_uri_complete}`);
  console.log("");
  console.log(`User code: ${authorization.user_code}`);
  console.log("");

  if (!options.noOpen) {
    try {
      await openFn(authorization.verification_uri_complete);
      logCommandInfo("Opened verification URL in the default browser");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Could not open browser automatically (${message}). Open the URL above.`,
      );
    }
  } else {
    logCommandInfo("Browser open suppressed (--no-open)");
  }

  logStep("Waiting for approval");
  let token;
  try {
    token = await waitForDeviceAuthorization({
      apiBase,
      deviceCode: authorization.device_code,
      userAgent: metadata.userAgent,
      intervalSeconds: authorization.interval,
      expiresInSeconds: authorization.expires_in,
      runtime: options.pollRuntime,
    });
  } catch (error) {
    if (error instanceof DeviceLoginError) {
      throw error;
    }
    throw error;
  }

  const credentialsPath = getCredentialsPath();
  // Interactive browser login: personal key only. Clear any stale file api_key so
  // project commands use the minted vthu_ (+ active_org_id). Env VOICETHERE_API_KEY
  // is unchanged and remains authoritative when set (we abort before mint if set).
  const browserCredentials: Credentials = {
    api_base: apiBase,
    user_api_key: token.access_token,
    active_org_id: token.active_org_id,
    dashboard_session_cookie: undefined,
  };
  await writeCredentials(browserCredentials);

  logStep("Saved personal API key");
  logCommandInfo(`credentials: ${credentialsPath}`);
  logCommandInfo(`active org: ${token.active_org_id}`);

  // Verify linked project with the freshly minted key — not ambient/stale credentials.
  // Never rewrite .voicethere/config.json. Emit machine `completed` only after success.
  const linked = await readProjectConfig(options.cwd ?? process.cwd());
  if (linked) {
    try {
      const api = createApiFromCredentials(browserCredentials);
      const remote = await api.getProject(linked.config.project_id);
      emitLoginMachineLine("status", "completed");
      emitLoginMachineLine("active_org_id", token.active_org_id);
      console.log(
        `Logged in. Linked project verified: ${remote.slug} (${remote.id})`,
      );
      return;
    } catch (error) {
      const detail =
        error instanceof ApiError
          ? `API ${error.status}${error.code ? ` (${error.code})` : ""}`
          : error instanceof Error
            ? error.message
            : "unknown error";
      emitLoginMachineLine("status", "linked_project_inaccessible");
      throw new Error(
        `Personal API key was saved, but the linked project could not be accessed (${detail}). ` +
          ".voicethere/config.json was not modified. Fix project access or run: voicethere projects use <projectId>",
      );
    }
  }

  emitLoginMachineLine("status", "completed");
  emitLoginMachineLine("active_org_id", token.active_org_id);
  console.log(
    `Logged in. Personal API key saved to ${credentialsPath} (expires in ~${Math.round(token.expires_in / 86400)} days).`,
  );
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const hasManualKey =
    Boolean(options.apiKey?.trim()) || Boolean(options.userApiKey?.trim());

  if (hasManualKey) {
    await runManualLogin(options);
    return;
  }

  if (options.dashboardCookie?.trim()) {
    // Legacy cookie-only path still needs an api key historically; allow pairing with existing file.
    const existing = await readCredentials();
    await runManualLogin({
      ...options,
      apiKey: existing?.api_key,
      userApiKey: options.userApiKey || existing?.user_api_key,
      dashboardCookie: options.dashboardCookie,
    });
    return;
  }

  await runBrowserLogin(options);
}
