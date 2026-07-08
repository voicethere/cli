import { logApiBase, logVerbose } from "./command-log.js";
import { ApiError, type ApiErrorBody } from "./api.js";

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

export class DashboardApi {
  constructor(
    private readonly apiBase: string,
    private readonly cookie: string,
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

  async confirmAccountDeletion(code: string): Promise<{ job_id: string }> {
    const response = await this.request<{ ok: boolean; job_id: string }>(
      "POST",
      "/account/deletion",
      { json: { code } },
    );
    return { job_id: response.job_id };
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { json?: unknown },
  ): Promise<T> {
    const url = new URL(
      path.replace(/^\//, ""),
      `${this.apiBase.replace(/\/$/, "")}/`,
    );
    const headers: Record<string, string> = {
      Cookie: this.cookie,
    };

    let body: BodyInit | undefined;
    if (options?.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const pathWithQuery = `${url.pathname}${url.search}`;
    logVerbose(`${method} ${pathWithQuery} (dashboard session)`);
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
      const message =
        errorBody?.error?.message ??
        `Request failed: ${method} ${url.pathname} (${response.status})`;
      logVerbose(`error: ${errorBody?.error?.code ?? "unknown"} — ${message}`);
      throw new ApiError(response.status, message, errorBody);
    }

    return (payload ?? ({} as T)) as T;
  }
}

export function createDashboardApi(
  apiBase: string,
  cookie: string,
): DashboardApi {
  return new DashboardApi(apiBase, cookie);
}
