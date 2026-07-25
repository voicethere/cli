import { ApiError, type ApiErrorBody } from "./api.js";
import { USER_ORG_ID_HEADER } from "./auth-headers.js";
import { logApiBase, logVerbose } from "./command-log.js";
import {
  formatTosNotAcceptedMessage,
  isTosNotAcceptedError,
} from "./tos-gate.js";
import type { UserCommandAuth } from "./user-session.js";

export { USER_ORG_ID_HEADER };

/** Must match platform `ACCOUNT_DELETION_POLL_TOKEN_HEADER`. */
export const ACCOUNT_DELETION_POLL_TOKEN_HEADER =
  "x-account-deletion-poll-token";

export interface OrgListEntry {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  is_owner: boolean;
}

export interface OrgListResponse {
  orgs: OrgListEntry[];
  active_org_id: string;
}

export interface AccountDeletionPreviewResponse {
  owned_orgs: Array<{
    id: string;
    name: string;
    slug: string;
    project_count: number;
  }>;
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    step: string;
    error: string | null;
    created_at: string;
    completed_at: string | null;
  } | null;
}

export interface AccountDeletionJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  step: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  retry_after_ms?: number | null;
}

export class UserApi {
  constructor(
    private readonly apiBase: string,
    private readonly auth: UserCommandAuth,
  ) {
    logApiBase(apiBase);
  }

  async listOrgs(): Promise<OrgListResponse> {
    return this.request<OrgListResponse>("GET", "/orgs");
  }

  async setActiveOrg(orgId: string): Promise<void> {
    await this.request<{ ok: boolean }>("POST", "/orgs/active", {
      json: { org_id: orgId },
    });
  }

  async transferOwnership(newOwnerUserId: string): Promise<void> {
    await this.request<{ ok: boolean }>("POST", "/org/transfer-ownership", {
      json: { new_owner_user_id: newOwnerUserId },
    });
  }

  async getAccountDeletionPreview(): Promise<AccountDeletionPreviewResponse> {
    return this.request<AccountDeletionPreviewResponse>(
      "GET",
      "/account/deletion",
    );
  }

  async requestAccountDeletionCode(): Promise<void> {
    await this.request<{ ok: boolean }>(
      "POST",
      "/account/deletion/request-code",
    );
  }

  async confirmAccountDeletion(code: string): Promise<{
    job_id: string;
    poll_token: string;
  }> {
    const response = await this.request<{
      ok: boolean;
      job_id: string;
      poll_token: string;
    }>("POST", "/account/deletion", { json: { code } });
    return { job_id: response.job_id, poll_token: response.poll_token };
  }

  async getAccountDeletionJob(
    jobId: string,
    pollToken: string,
  ): Promise<AccountDeletionJob> {
    return this.request<AccountDeletionJob>(
      "GET",
      `/account/deletion/jobs/${jobId}`,
      { pollToken },
    );
  }

  private authLabel(): string {
    return this.auth.kind === "user_api_key"
      ? "user API key"
      : "dashboard session";
  }

  private buildHeaders(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.auth.kind === "user_api_key") {
      headers.Authorization = `Bearer ${this.auth.token}`;
      if (this.auth.activeOrgId) {
        headers[USER_ORG_ID_HEADER] = this.auth.activeOrgId;
      }
    } else {
      headers.Cookie = this.auth.cookie;
    }
    if (json) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { json?: unknown; pollToken?: string },
  ): Promise<T> {
    const url = new URL(
      path.replace(/^\//, ""),
      `${this.apiBase.replace(/\/$/, "")}/`,
    );
    const headers = this.buildHeaders(options?.json !== undefined);
    if (options?.pollToken) {
      headers[ACCOUNT_DELETION_POLL_TOKEN_HEADER] = options.pollToken;
    }

    let body: BodyInit | undefined;
    if (options?.json !== undefined) {
      body = JSON.stringify(options.json);
    }

    const pathWithQuery = `${url.pathname}${url.search}`;
    logVerbose(`${method} ${pathWithQuery} (${this.authLabel()})`);
    if (options?.json !== undefined) {
      logVerbose(`request body: ${JSON.stringify(options.json)}`);
    }

    const started = performance.now();
    const response = await fetch(url, { method, headers, body });
    logVerbose(
      `response: ${response.status} (${Math.round(performance.now() - started)}ms)`,
    );
    const text = await response.text();
    const payload =
      text.length > 0 ? (JSON.parse(text) as T | ApiErrorBody) : null;

    if (!response.ok) {
      const errorBody =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as ApiErrorBody)
          : undefined;
      const message = isTosNotAcceptedError(errorBody)
        ? formatTosNotAcceptedMessage(
            errorBody,
            errorBody?.error?.message ?? "",
          )
        : (errorBody?.error?.message ??
          `Request failed: ${method} ${url.pathname} (${response.status})`);
      logVerbose(`error: ${errorBody?.error?.code ?? "unknown"} — ${message}`);
      throw new ApiError(response.status, message, errorBody);
    }

    return (payload ?? ({} as T)) as T;
  }
}

export function createUserApi(apiBase: string, auth: UserCommandAuth): UserApi {
  return new UserApi(apiBase, auth);
}
