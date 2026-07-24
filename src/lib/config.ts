import { randomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_API_BASE = "https://app.voicethere.dev/api/v1";

export interface Credentials {
  /**
   * Org / project API key (`vth_` / `vthc_`). Optional when `user_api_key` is set.
   * Kept for automation and legacy login.
   */
  api_key?: string;
  api_base: string;
  /** Personal user API key (`vthu_`) for org/account and browser-login CLI. */
  user_api_key?: string;
  /** Active organization when using a user API key. */
  active_org_id?: string;
  /** @deprecated Browser Cookie header — cleared on browser device login. */
  dashboard_session_cookie?: string;
}

/** Effective credentials after applying env overrides (not written to disk). */
export interface EffectiveCredentials extends Credentials {
  apiKeyFromEnv: boolean;
  userApiKeyFromEnv: boolean;
  apiBaseFromEnv: boolean;
  orgIdFromEnv: boolean;
}

export function getCredentialsPath(): string {
  const override = process.env.VOICETHERE_CREDENTIALS_PATH?.trim();
  if (override) {
    return override;
  }
  return join(homedir(), ".config", "voicethere", "credentials.json");
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeApiBase(raw: string | undefined): string {
  const base = (raw?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
  return base.length > 0 ? base : DEFAULT_API_BASE;
}

export function credentialsHaveAuth(credentials: Credentials): boolean {
  return Boolean(credentials.api_key || credentials.user_api_key);
}

export async function readCredentials(): Promise<Credentials | null> {
  const path = getCredentialsPath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    const api_key = nonEmptyString(parsed.api_key);
    const user_api_key = nonEmptyString(parsed.user_api_key);
    if (!api_key && !user_api_key) {
      return null;
    }
    const credentials: Credentials = {
      api_base: normalizeApiBase(nonEmptyString(parsed.api_base)),
    };
    if (api_key) {
      credentials.api_key = api_key;
    }
    if (user_api_key) {
      credentials.user_api_key = user_api_key;
    }
    const active_org_id = nonEmptyString(parsed.active_org_id);
    if (active_org_id) {
      credentials.active_org_id = active_org_id;
    }
    const dashboard_session_cookie = nonEmptyString(
      parsed.dashboard_session_cookie,
    );
    if (dashboard_session_cookie) {
      credentials.dashboard_session_cookie = dashboard_session_cookie;
    }
    return credentials;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Merge credentials file with env overrides.
 * Precedence: VOICETHERE_API_KEY / VOICETHERE_USER_API_KEY / VOICETHERE_API_BASE /
 * VOICETHERE_ORG_ID over file values.
 */
export async function resolveEffectiveCredentials(): Promise<EffectiveCredentials | null> {
  const file = await readCredentials();
  const envApiKey = nonEmptyString(process.env.VOICETHERE_API_KEY);
  const envUserKey = nonEmptyString(process.env.VOICETHERE_USER_API_KEY);
  const envApiBase = nonEmptyString(process.env.VOICETHERE_API_BASE);
  const envOrgId = nonEmptyString(process.env.VOICETHERE_ORG_ID);

  const api_key = envApiKey || file?.api_key;
  const user_api_key = envUserKey || file?.user_api_key;
  if (!api_key && !user_api_key) {
    return null;
  }

  return {
    api_key,
    user_api_key,
    api_base: normalizeApiBase(envApiBase || file?.api_base),
    active_org_id: envOrgId || file?.active_org_id,
    dashboard_session_cookie: file?.dashboard_session_cookie,
    apiKeyFromEnv: Boolean(envApiKey),
    userApiKeyFromEnv: Boolean(envUserKey),
    apiBaseFromEnv: Boolean(envApiBase),
    orgIdFromEnv: Boolean(envOrgId),
  };
}

function serializeCredentials(credentials: Credentials): Credentials {
  const api_base = normalizeApiBase(credentials.api_base);
  const api_key = nonEmptyString(credentials.api_key);
  const user_api_key = nonEmptyString(credentials.user_api_key);
  if (!api_key && !user_api_key) {
    throw new Error("credentials must include api_key and/or user_api_key");
  }
  const out: Credentials = { api_base };
  if (api_key) {
    out.api_key = api_key;
  }
  if (user_api_key) {
    out.user_api_key = user_api_key;
  }
  const active_org_id = nonEmptyString(credentials.active_org_id);
  if (active_org_id) {
    out.active_org_id = active_org_id;
  }
  const cookie = nonEmptyString(credentials.dashboard_session_cookie);
  if (cookie) {
    out.dashboard_session_cookie = cookie;
  }
  return out;
}

/** Atomic write: temp file + chmod 0600 + rename. */
export async function writeCredentials(
  credentials: Credentials,
): Promise<void> {
  const path = getCredentialsPath();
  const payload = serializeCredentials(credentials);
  await mkdir(dirname(path), { recursive: true });

  const tmpPath = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    await writeFile(tmpPath, body, { encoding: "utf8", mode: 0o600 });
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, path);
  } catch (error) {
    // Windows may refuse rename over an existing file — fall back to unlink+rename.
    if ((error as NodeJS.ErrnoException).code === "EEXIST" ||
      (error as NodeJS.ErrnoException).code === "EPERM") {
      try {
        await unlink(path);
      } catch {
        // ignore missing
      }
      await rename(tmpPath, path);
    } else {
      try {
        await unlink(tmpPath);
      } catch {
        // ignore
      }
      throw error;
    }
  }
  await chmod(path, 0o600);
}

export async function patchCredentials(
  partial: Partial<
    Pick<
      Credentials,
      "api_key" | "user_api_key" | "active_org_id" | "dashboard_session_cookie" | "api_base"
    >
  >,
): Promise<Credentials> {
  const existing = await readCredentials();
  if (!existing) {
    throw new Error(
      "Not logged in. Run: voicethere login  (or: voicethere login --api-key <key>)",
    );
  }
  const next: Credentials = { ...existing, ...partial };
  // Explicit undefined in partial clears optional fields when key is present.
  for (const key of [
    "api_key",
    "user_api_key",
    "active_org_id",
    "dashboard_session_cookie",
  ] as const) {
    if (key in partial && partial[key] === undefined) {
      delete next[key];
    }
  }
  await writeCredentials(next);
  return (await readCredentials())!;
}

export async function requireCredentials(): Promise<EffectiveCredentials> {
  const credentials = await resolveEffectiveCredentials();
  if (!credentials) {
    throw new Error(
      "Not logged in. Run: voicethere login  (or: voicethere login --api-key <key>)",
    );
  }
  return credentials;
}

export function warnEnvCredentialOverrides(
  effective: EffectiveCredentials,
  log: (message: string) => void = console.warn,
): void {
  if (effective.apiKeyFromEnv) {
    log(
      "Warning: VOICETHERE_API_KEY is set and overrides the saved org/project API key.",
    );
  }
  if (effective.userApiKeyFromEnv) {
    log(
      "Warning: VOICETHERE_USER_API_KEY is set and overrides the saved personal API key.",
    );
  }
  if (effective.apiBaseFromEnv) {
    log(
      "Warning: VOICETHERE_API_BASE is set and overrides the saved API base URL.",
    );
  }
  if (effective.orgIdFromEnv) {
    log(
      "Warning: VOICETHERE_ORG_ID is set and overrides the saved active organization.",
    );
  }
}
