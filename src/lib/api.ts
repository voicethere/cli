import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code;
    this.requestId = body?.error?.request_id;
  }
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  active_build_id: string | null;
  created_at: string;
}

export interface Build {
  id: string;
  project_id: string;
  storage_path?: string;
  size_bytes: number;
  checksum_sha256: string;
  validation_status: string;
  message?: string | null;
  created_at: string;
}

export interface PromoteResult {
  project_id: string;
  active_build_id: string;
  active_storage_path: string;
}

export class VoicethereApi {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase: string,
  ) {}

  async listProjects(): Promise<Project[]> {
    const response = await this.request<{ projects: Project[] } | Project[]>(
      "GET",
      "/projects",
    );
    return Array.isArray(response) ? response : response.projects;
  }

  async createProject(name: string, slug: string): Promise<Project> {
    return this.request<Project>("POST", "/projects", {
      json: { name, slug },
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>("GET", `/projects/${projectId}`);
  }

  async listBuilds(projectId: string): Promise<Build[]> {
    const response = await this.request<{ builds: Build[] }>(
      "GET",
      `/projects/${projectId}/builds`,
    );
    return response.builds;
  }

  async uploadBuild(
    projectId: string,
    bundlePath: string,
    message?: string,
  ): Promise<Build> {
    const buffer = await readFile(bundlePath);
    const form = new FormData();
    form.append(
      "bundle",
      new Blob([buffer], { type: "application/javascript" }),
      basename(bundlePath),
    );

    const trimmedMessage = message?.trim();
    if (trimmedMessage) {
      form.append("message", trimmedMessage);
    }

    return this.request<Build>("POST", `/projects/${projectId}/builds`, {
      body: form,
    });
  }

  async promote(projectId: string, buildId?: string): Promise<PromoteResult> {
    return this.request<PromoteResult>(
      "POST",
      `/projects/${projectId}/promote`,
      {
        json: buildId ? { build_id: buildId } : {},
      },
    );
  }

  async rollback(projectId: string, buildId?: string): Promise<PromoteResult> {
    return this.request<PromoteResult>(
      "POST",
      `/projects/${projectId}/rollback`,
      {
        json: buildId ? { build_id: buildId } : {},
      },
    );
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      json?: unknown;
      body?: FormData;
    },
  ): Promise<T> {
    const url = new URL(
      path.replace(/^\//, ""),
      `${this.apiBase.replace(/\/$/, "")}/`,
    );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    let body: BodyInit | undefined;
    if (options?.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options?.body) {
      body = options.body;
    }

    const response = await fetch(url, { method, headers, body });
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
      throw new ApiError(response.status, message, errorBody);
    }

    return (payload ?? ({} as T)) as T;
  }
}

export function createApi(apiKey: string, apiBase: string): VoicethereApi {
  return new VoicethereApi(apiKey, apiBase);
}
