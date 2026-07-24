import { hostname, platform, release, type, userInfo } from "node:os";

import { ApiError, type ApiErrorBody } from "./api.js";
import { logVerbose } from "./command-log.js";
import {
  type PollRuntime,
  defaultPollRuntime,
  pollWithBackoff,
} from "./poll-backoff.js";

export const DEVICE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:device_code" as const;

export type DeviceAuthorizeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

export type DeviceTokenSuccess = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  active_org_id: string;
};

export type DeviceTokenPollStatus =
  | "pending"
  | "slow_down"
  | "approved"
  | "denied"
  | "expired"
  | "invalid_grant";

export type DeviceTokenPollResult =
  | {
      status: "pending" | "slow_down";
      intervalSeconds?: number;
      retryAfterMs?: number | null;
    }
  | {
      status: "approved";
      accessToken: string;
      activeOrgId: string;
      expiresIn: number;
    }
  | { status: "denied" | "expired" | "invalid_grant"; description?: string };

export class DeviceLoginError extends Error {
  readonly code:
    | "access_denied"
    | "expired_token"
    | "invalid_grant"
    | "timeout"
    | "network";

  constructor(
    code: DeviceLoginError["code"],
    message: string,
  ) {
    super(message);
    this.name = "DeviceLoginError";
    this.code = code;
  }
}

export type DeviceLoginMetadata = {
  cliVersion: string;
  cliOs: string;
  deviceLabel: string;
  userAgent: string;
};

export function buildDeviceLoginMetadata(cliVersion: string): DeviceLoginMetadata {
  const cliOs = `${platform()} ${release()}`;
  let userName = "user";
  try {
    userName = userInfo().username || "user";
  } catch {
    // ignore
  }
  const host = hostname() || "device";
  const deviceLabel = `${userName}@${host} (${type()})`.slice(0, 120);
  const userAgent = `voicethere-cli/${cliVersion} (${platform()}; ${release()})`;
  return { cliVersion, cliOs, deviceLabel, userAgent };
}

function deviceApiUrl(apiBase: string, path: string): URL {
  return new URL(
    path.replace(/^\//, ""),
    `${apiBase.replace(/\/$/, "")}/`,
  );
}

/** Never log bodies that may contain device_code or access_token. */
function logDeviceHttp(method: string, path: string, status?: number): void {
  if (status == null) {
    logVerbose(`${method} ${path} (device-login)`);
    return;
  }
  logVerbose(`response: ${status} (device-login)`);
}

export async function initiateDeviceAuthorization(
  apiBase: string,
  input: {
    requestedProjectId?: string;
    metadata: DeviceLoginMetadata;
  },
): Promise<DeviceAuthorizeResponse> {
  const url = deviceApiUrl(apiBase, "/cli/device/authorize");
  const json: Record<string, string> = {
    cli_version: input.metadata.cliVersion.slice(0, 64),
    cli_os: input.metadata.cliOs.slice(0, 64),
    device_label: input.metadata.deviceLabel.slice(0, 120),
  };
  if (input.requestedProjectId) {
    json.requested_project_id = input.requestedProjectId;
  }

  logDeviceHttp("POST", url.pathname);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": input.metadata.userAgent,
    },
    body: JSON.stringify(json),
  });
  logDeviceHttp("POST", url.pathname, response.status);

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as ApiErrorBody)
        : undefined;
    throw new ApiError(
      response.status,
      errorBody?.error?.message ??
        `Device authorization failed (${response.status})`,
      errorBody,
    );
  }

  const body = payload as Partial<DeviceAuthorizeResponse>;
  if (
    typeof body.device_code !== "string" ||
    typeof body.user_code !== "string" ||
    typeof body.verification_uri !== "string" ||
    typeof body.verification_uri_complete !== "string" ||
    typeof body.expires_in !== "number" ||
    typeof body.interval !== "number"
  ) {
    throw new Error("Invalid device authorization response from API");
  }

  return {
    device_code: body.device_code,
    user_code: body.user_code,
    verification_uri: body.verification_uri,
    verification_uri_complete: body.verification_uri_complete,
    expires_in: body.expires_in,
    interval: body.interval,
  };
}

export async function pollDeviceTokenOnce(
  apiBase: string,
  deviceCode: string,
  userAgent: string,
): Promise<DeviceTokenPollResult> {
  const url = deviceApiUrl(apiBase, "/cli/device/token");
  logDeviceHttp("POST", url.pathname);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      grant_type: DEVICE_GRANT_TYPE,
      device_code: deviceCode,
    }),
  });
  logDeviceHttp("POST", url.pathname, response.status);

  const retryAfterHeader = response.headers.get("retry-after");
  let retryAfterMs: number | null = null;
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      retryAfterMs = Math.round(seconds * 1000);
    }
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (response.ok) {
    const accessToken = payload.access_token;
    const activeOrgId = payload.active_org_id;
    const expiresIn = payload.expires_in;
    if (
      typeof accessToken !== "string" ||
      typeof activeOrgId !== "string" ||
      typeof expiresIn !== "number"
    ) {
      throw new Error("Invalid device token success response from API");
    }
    return {
      status: "approved",
      accessToken,
      activeOrgId,
      expiresIn,
    };
  }

  const errorCode =
    typeof payload.error === "string" ? payload.error : "invalid_grant";
  const description =
    typeof payload.error_description === "string"
      ? payload.error_description
      : undefined;
  const intervalSeconds =
    typeof payload.interval === "number" ? payload.interval : undefined;

  if (errorCode === "authorization_pending") {
    return {
      status: "pending",
      intervalSeconds,
      retryAfterMs,
    };
  }
  if (errorCode === "slow_down") {
    return {
      status: "slow_down",
      intervalSeconds,
      retryAfterMs:
        retryAfterMs ??
        (intervalSeconds != null ? intervalSeconds * 1000 : null),
    };
  }
  if (errorCode === "access_denied") {
    return { status: "denied", description };
  }
  if (errorCode === "expired_token") {
    return { status: "expired", description };
  }
  return { status: "invalid_grant", description };
}

export async function waitForDeviceAuthorization(options: {
  apiBase: string;
  deviceCode: string;
  userAgent: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  runtime?: PollRuntime;
  onPoll?: (result: DeviceTokenPollResult) => void;
}): Promise<DeviceTokenSuccess> {
  const baseIntervalMs = Math.max(1, Math.round(options.intervalSeconds * 1000));
  // Cap wait slightly under server expiry so we surface expired_token when possible.
  const timeoutMs = Math.max(
    baseIntervalMs,
    Math.round(options.expiresInSeconds * 1000) + 5_000,
  );

  let intervalMs = baseIntervalMs;

  let terminal: DeviceTokenPollResult;
  try {
    terminal = await pollWithBackoff<DeviceTokenPollResult>({
      poll: () =>
        pollDeviceTokenOnce(
          options.apiBase,
          options.deviceCode,
          options.userAgent,
        ),
      isTerminal: (value) =>
        value.status === "approved" ||
        value.status === "denied" ||
        value.status === "expired" ||
        value.status === "invalid_grant",
      getProgress: (value) => ({ status: value.status }),
      getRetryAfterMs: (value) => {
        if (value.status === "pending" || value.status === "slow_down") {
          if (value.intervalSeconds != null && value.intervalSeconds > 0) {
            intervalMs = Math.round(value.intervalSeconds * 1000);
          }
          if (value.retryAfterMs != null && value.retryAfterMs > 0) {
            return value.retryAfterMs;
          }
          if (value.status === "slow_down") {
            return intervalMs * 2;
          }
        }
        return null;
      },
      onPoll: options.onPoll,
      baseIntervalMs: intervalMs,
      timeoutMs,
      timeoutMessage:
        "Timed out waiting for browser approval. Run voicethere login again.",
      runtime: options.runtime ?? defaultPollRuntime,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timed out")) {
      throw new DeviceLoginError("timeout", error.message);
    }
    throw error;
  }

  if (terminal.status === "approved") {
    return {
      access_token: terminal.accessToken,
      token_type: "Bearer",
      expires_in: terminal.expiresIn,
      active_org_id: terminal.activeOrgId,
    };
  }
  if (terminal.status === "denied") {
    throw new DeviceLoginError(
      "access_denied",
      ("description" in terminal && terminal.description) ||
        "Browser login was declined. Run voicethere login again if this was a mistake.",
    );
  }
  if (terminal.status === "expired") {
    throw new DeviceLoginError(
      "expired_token",
      ("description" in terminal && terminal.description) ||
        "The login code expired. Run voicethere login again.",
    );
  }
  throw new DeviceLoginError(
    "invalid_grant",
    ("description" in terminal && terminal.description) ||
      "Device login failed. Run voicethere login again.",
  );
}
