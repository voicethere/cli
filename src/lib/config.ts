import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_API_BASE = "https://app.voicethere.dev/api/v1";

export interface Credentials {
  api_key: string;
  api_base: string;
  /** Personal user API key (`vthu_`) for org/account CLI commands. */
  user_api_key?: string;
  /** Active organization when using a user API key. */
  active_org_id?: string;
  /** @deprecated Browser Cookie header — prefer user_api_key. */
  dashboard_session_cookie?: string;
}

export function getCredentialsPath(): string {
  const override = process.env.VOICETHERE_CREDENTIALS_PATH?.trim();
  if (override) {
    return override;
  }
  return join(homedir(), ".config", "voicethere", "credentials.json");
}

export async function readCredentials(): Promise<Credentials | null> {
  const path = getCredentialsPath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    if (
      typeof parsed.api_key !== "string" ||
      parsed.api_key.length === 0 ||
      typeof parsed.api_base !== "string" ||
      parsed.api_base.length === 0
    ) {
      return null;
    }
    return {
      api_key: parsed.api_key,
      api_base: parsed.api_base,
      user_api_key:
        typeof parsed.user_api_key === "string" &&
        parsed.user_api_key.length > 0
          ? parsed.user_api_key
          : undefined,
      active_org_id:
        typeof parsed.active_org_id === "string" &&
        parsed.active_org_id.length > 0
          ? parsed.active_org_id
          : undefined,
      dashboard_session_cookie:
        typeof parsed.dashboard_session_cookie === "string" &&
        parsed.dashboard_session_cookie.length > 0
          ? parsed.dashboard_session_cookie
          : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCredentials(
  credentials: Credentials,
): Promise<void> {
  const path = getCredentialsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(path, 0o600);
}

export async function patchCredentials(
  partial: Partial<
    Pick<
      Credentials,
      "user_api_key" | "active_org_id" | "dashboard_session_cookie"
    >
  >,
): Promise<Credentials> {
  const existing = await readCredentials();
  if (!existing) {
    throw new Error(
      "Not logged in. Run: voicethere login --api-key <key> [--api-base <url>]",
    );
  }
  const next: Credentials = { ...existing, ...partial };
  await writeCredentials(next);
  return next;
}

export async function requireCredentials(): Promise<Credentials> {
  const credentials = await readCredentials();
  if (!credentials) {
    throw new Error(
      "Not logged in. Run: voicethere login --api-key <key> [--api-base <url>]",
    );
  }
  return credentials;
}
