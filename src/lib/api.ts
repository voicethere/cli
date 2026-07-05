import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { logApiBase, logVerbose } from "./command-log.js";

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
  deployed_build_id: string | null;
  deployed_at: string | null;
  is_deployed: boolean;
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

export type DeploymentStatus = "queued" | "active" | "completed" | "failed";

export type DeploymentMode = "drain" | "force" | "undeploy";

export interface DeploymentJob {
  id: string;
  org_id: string;
  project_id: string;
  build_id: string;
  status: DeploymentStatus;
  mode: DeploymentMode;
  bullmq_job_id: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ProjectSecretEntry {
  name: string;
  masked_value: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectEnvEntry {
  key: string;
  value: string;
}

export interface ProjectEnvListResponse {
  project_id: string;
  variables: ProjectEnvEntry[];
}

export interface ProjectSecretListResponse {
  project_id: string;
  secrets: ProjectSecretEntry[];
}

export interface CreateDeploymentInput {
  project_id: string;
  build_id?: string;
  mode?: "drain" | "force";
  trace_id?: string;
}

export interface ProjectSettingsResponse {
  project_id: string;
  settings: {
    mode?: "voice" | "data" | "voice+data";
    warm_pool_enabled: boolean;
    idle_scale_down_seconds: number;
    data_only?: boolean;
    shared_child_per_session?: boolean;
    agent_crash_policy?: "disconnect_all" | "restart_child";
    agent_child_ipc_debug?: boolean;
  };
  defaults?: {
    mode?: "voice" | "data" | "voice+data";
    warm_pool_enabled: boolean;
    idle_scale_down_seconds: number;
    data_only?: boolean;
    shared_child_per_session?: boolean;
    agent_crash_policy?: "disconnect_all" | "restart_child";
    agent_child_ipc_debug?: boolean;
  };
}

export interface ProjectSessionSettingsResponse {
  project_id: string;
  settings: {
    error_message?: string;
    idle_timeout_enabled?: boolean;
    idle_timeout_seconds?: number;
    data_only_idle_timeout_seconds?: number;
    idle_timeout_voice_activity?: boolean;
    idle_timeout_dc_inbound?: boolean;
  };
}

export type ProjectSessionSettingKey =
  keyof ProjectSessionSettingsResponse["settings"];

export type VoiceProviderId =
  | "local-sherpa"
  | "openai"
  | "deepgram"
  | "assemblyai"
  | "google"
  | "elevenlabs"
  | "cartesia";

export interface ProjectVoiceSettings {
  stt_provider: VoiceProviderId;
  tts_provider: VoiceProviderId;
  stt_model_id: string;
  tts_model_id: string;
  stt_model?: string;
  stt_language?: string;
  tts_model?: string;
  tts_voice?: string;
}

export type VoiceAdvancedSettingKey =
  | "vad.enabled"
  | "vad.provider"
  | "vad.threshold"
  | "vad.minSpeechDurationMs"
  | "vad.minSilenceDurationMs"
  | "vad.speechPadMs"
  | "vad.sampleRate"
  | "vad.gateStt"
  | "vad.gateSttOpenOnPending"
  | "vad.sttGateHoldMs"
  | "vad.sttListenTimeoutMs"
  | "vad.utteranceFinalizeTimeoutMs"
  | "vad.bargeIn.enabled"
  | "vad.bargeIn.useVad"
  | "vad.bargeIn.flushTts"
  | "vad.bargeIn.requireSttPartial"
  | "vad.bargeIn.minSttPartialChars"
  | "vad.bargeIn.agentPlaybackGuardMs"
  | "events.mode";

export interface ProjectVoiceAdvancedSettingsResponse {
  project_id: string;
  settings: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

export interface VoiceCatalogResponse {
  default_stt_model_id: string;
  default_tts_model_id: string;
  default_stt_provider: VoiceProviderId;
  default_tts_provider: VoiceProviderId;
  stt_models: Array<{ id: string; label: string; language: string }>;
  tts_models: Array<{ id: string; label: string; language: string }>;
  stt_providers: Array<{
    id: VoiceProviderId;
    label: string;
    notes: string;
    required_credentials: Array<{
      runner_key: string;
      agent_secret_key: string;
      label: string;
      description: string;
    }>;
    optional_env: Array<{
      runner_key: string;
      agent_env_key: string;
      label: string;
      description: string;
      placeholder?: string;
    }>;
  }>;
  tts_providers: Array<{
    id: VoiceProviderId;
    label: string;
    notes: string;
    required_credentials: Array<{
      runner_key: string;
      agent_secret_key: string;
      label: string;
      description: string;
    }>;
    optional_env: Array<{
      runner_key: string;
      agent_env_key: string;
      label: string;
      description: string;
      placeholder?: string;
    }>;
  }>;
}

export type ApiKeyKind = "admin" | "client";

export interface ApiKeyEntry {
  id: string;
  name: string;
  kind: ApiKeyKind;
  key_prefix: string;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface ApiKeyListResponse {
  api_keys: ApiKeyEntry[];
}

export interface CreateApiKeyInput {
  name: string;
  kind?: ApiKeyKind;
  project_id?: string;
  expires_in_days?: number;
}

export interface CreateApiKeyResponse extends ApiKeyEntry {
  api_key: string;
}

export type ProjectSettingKey =
  | "mode"
  | "warm_pool_enabled"
  | "idle_scale_down_seconds"
  | "data_only"
  | "shared_child_per_session"
  | "agent_crash_policy"
  | "agent_child_ipc_debug";

export type ProjectSubscriptionTier = "free" | "ultimate";
export type OrgSubscriptionStatus = "active" | "canceled";

export interface OrgSubscription {
  id: string;
  org_id: string;
  project_id: string | null;
  tier: ProjectSubscriptionTier;
  price_id: string | null;
  status: OrgSubscriptionStatus;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
}

export interface ProjectSubscriptionResponse {
  project_id: string;
  subscription: OrgSubscription | null;
}

export type ProjectSessionStatus = "active" | "ended" | "failed";

export interface ProjectSessionEntry {
  id: string;
  orchestrator_session_id: string;
  status: ProjectSessionStatus;
  build_id: string | null;
  created_at: string;
  billing_started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  billable_seconds: number | null;
  expires_at: string | null;
}

export interface ProjectSessionListResponse {
  sessions: ProjectSessionEntry[];
  start: number;
  end: number;
  count: number;
}

export interface ProjectSessionErrorEntry {
  id: string;
  orchestrator_session_id: string;
  source: "agent" | "runner" | "provisioning";
  code: string;
  message: string;
  stack_trace: string | null;
  created_at: string;
}

export interface ProjectSessionErrorsResponse {
  project_id: string;
  orchestrator_session_id?: string;
  errors: ProjectSessionErrorEntry[];
}

export class VoicethereApi {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase: string,
  ) {
    logApiBase(apiBase);
  }

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

  async createDeployment(input: CreateDeploymentInput): Promise<DeploymentJob> {
    return this.request<DeploymentJob>("POST", "/deployments", {
      json: input,
    });
  }

  async undeployProject(projectId: string): Promise<DeploymentJob> {
    return this.request<DeploymentJob>(
      "POST",
      `/projects/${projectId}/undeploy`,
    );
  }

  async getDeployment(jobId: string): Promise<DeploymentJob> {
    return this.request<DeploymentJob>("GET", `/deployments/${jobId}`);
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

  async deleteProject(
    projectId: string,
    options?: { force?: boolean; confirmName?: string },
  ): Promise<void> {
    const query = options?.force ? "?force=true" : "";
    await this.request<Record<string, never>>(
      "DELETE",
      `/projects/${projectId}${query}`,
      {
        json: options?.confirmName
          ? { confirm_name: options.confirmName }
          : undefined,
      },
    );
  }

  async listProjectEnvironment(
    projectId: string,
  ): Promise<ProjectEnvListResponse> {
    return this.request<ProjectEnvListResponse>(
      "GET",
      `/projects/${projectId}/environment`,
    );
  }

  async getProjectEnvironmentVariable(
    projectId: string,
    key: string,
  ): Promise<ProjectEnvEntry> {
    return this.request<ProjectEnvEntry>(
      "GET",
      `/projects/${projectId}/environment/${encodeURIComponent(key)}`,
    );
  }

  async upsertProjectEnvironmentVariable(
    projectId: string,
    key: string,
    value: string,
  ): Promise<ProjectEnvEntry> {
    return this.request<ProjectEnvEntry>(
      "PUT",
      `/projects/${projectId}/environment/${encodeURIComponent(key)}`,
      { json: { value } },
    );
  }

  async deleteProjectEnvironmentVariable(
    projectId: string,
    key: string,
  ): Promise<void> {
    await this.request<Record<string, never>>(
      "DELETE",
      `/projects/${projectId}/environment/${encodeURIComponent(key)}`,
    );
  }

  async listProjectSecrets(
    projectId: string,
  ): Promise<ProjectSecretListResponse> {
    return this.request<ProjectSecretListResponse>(
      "GET",
      `/projects/${projectId}/secrets`,
    );
  }

  async createProjectSecret(
    projectId: string,
    name: string,
    value: string,
  ): Promise<ProjectSecretEntry> {
    return this.request<ProjectSecretEntry>(
      "POST",
      `/projects/${projectId}/secrets`,
      {
        json: { name, value },
      },
    );
  }

  async deleteProjectSecret(projectId: string, name: string): Promise<void> {
    await this.request<Record<string, never>>(
      "DELETE",
      `/projects/${projectId}/secrets/${encodeURIComponent(name)}`,
    );
  }

  async listProjectSettings(
    projectId: string,
  ): Promise<ProjectSettingsResponse> {
    return this.request<ProjectSettingsResponse>(
      "GET",
      `/projects/${projectId}/settings`,
    );
  }

  async setProjectSetting(
    projectId: string,
    key: ProjectSettingKey,
    value: boolean | number | string,
  ): Promise<ProjectSettingsResponse> {
    return this.request<ProjectSettingsResponse>(
      "PATCH",
      `/projects/${projectId}/settings`,
      { json: { key, value } },
    );
  }

  async listSubscriptions(): Promise<OrgSubscription[]> {
    const response = await this.request<{ subscriptions: OrgSubscription[] }>(
      "GET",
      "/subscriptions",
    );
    return response.subscriptions;
  }

  async getProjectSubscription(
    projectId: string,
  ): Promise<ProjectSubscriptionResponse> {
    return this.request<ProjectSubscriptionResponse>(
      "GET",
      `/projects/${projectId}/subscription`,
    );
  }

  async setProjectSubscription(
    projectId: string,
    subscriptionId: string,
  ): Promise<ProjectSubscriptionResponse> {
    return this.request<ProjectSubscriptionResponse>(
      "PATCH",
      `/projects/${projectId}/subscription`,
      {
        json: {
          subscription_id: subscriptionId,
        },
      },
    );
  }

  async listProjectSessionSettings(
    projectId: string,
  ): Promise<ProjectSessionSettingsResponse> {
    return this.request<ProjectSessionSettingsResponse>(
      "GET",
      `/projects/${projectId}/session-settings`,
    );
  }

  async setProjectSessionSetting(
    projectId: string,
    key: ProjectSessionSettingKey,
    value: boolean | number | string,
  ): Promise<ProjectSessionSettingsResponse> {
    return this.request<ProjectSessionSettingsResponse>(
      "PATCH",
      `/projects/${projectId}/session-settings`,
      { json: { key, value } },
    );
  }

  async listVoiceModels(): Promise<VoiceCatalogResponse> {
    return this.request<VoiceCatalogResponse>("GET", "/voice/models");
  }

  async getProjectVoiceSettings(
    projectId: string,
  ): Promise<ProjectVoiceSettings> {
    return this.request<ProjectVoiceSettings>(
      "GET",
      `/projects/${projectId}/voice-settings`,
    );
  }

  async updateProjectVoiceSettings(
    projectId: string,
    input: Partial<ProjectVoiceSettings> & {
      stt_provider: VoiceProviderId;
      tts_provider: VoiceProviderId;
      stt_model_id: string;
      tts_model_id: string;
    },
  ): Promise<ProjectVoiceSettings> {
    return this.request<ProjectVoiceSettings>(
      "PATCH",
      `/projects/${projectId}/voice-settings`,
      { json: input },
    );
  }

  async listProjectVoiceAdvancedSettings(
    projectId: string,
  ): Promise<ProjectVoiceAdvancedSettingsResponse> {
    return this.request<ProjectVoiceAdvancedSettingsResponse>(
      "GET",
      `/projects/${projectId}/voice-advanced-settings`,
    );
  }

  async setProjectVoiceAdvancedSetting(
    projectId: string,
    key: VoiceAdvancedSettingKey,
    value: boolean | number | string,
  ): Promise<ProjectVoiceAdvancedSettingsResponse> {
    return this.request<ProjectVoiceAdvancedSettingsResponse>(
      "PATCH",
      `/projects/${projectId}/voice-advanced-settings`,
      { json: { key, value } },
    );
  }

  async resetProjectVoiceAdvancedSettings(
    projectId: string,
  ): Promise<ProjectVoiceAdvancedSettingsResponse> {
    return this.request<ProjectVoiceAdvancedSettingsResponse>(
      "PATCH",
      `/projects/${projectId}/voice-advanced-settings`,
      { json: { reset: true } },
    );
  }

  async listApiKeys(): Promise<ApiKeyListResponse> {
    return this.request<ApiKeyListResponse>("GET", "/api-keys");
  }

  async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>("POST", "/api-keys", {
      json: input,
    });
  }

  async revokeApiKey(id: string): Promise<ApiKeyEntry> {
    return this.request<ApiKeyEntry>("DELETE", `/api-keys/${id}`);
  }

  async listProjectSessions(
    projectId: string,
    options?: { start?: number; end?: number },
  ): Promise<ProjectSessionListResponse> {
    const params = new URLSearchParams();
    if (options?.start != null) {
      params.set("start", String(options.start));
    }
    if (options?.end != null) {
      params.set("end", String(options.end));
    }
    const query = params.toString();
    const path = `/projects/${projectId}/sessions${query ? `?${query}` : ""}`;
    return this.request<ProjectSessionListResponse>("GET", path);
  }

  async getProjectSession(
    projectId: string,
    orchestratorSessionId: string,
  ): Promise<ProjectSessionEntry> {
    return this.request<ProjectSessionEntry>(
      "GET",
      `/projects/${projectId}/sessions/${encodeURIComponent(orchestratorSessionId)}`,
    );
  }

  async listProjectSessionErrors(
    projectId: string,
    limit = 20,
  ): Promise<ProjectSessionErrorsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.request<ProjectSessionErrorsResponse>(
      "GET",
      `/projects/${projectId}/session-errors?${params.toString()}`,
    );
  }

  async listSessionErrors(
    projectId: string,
    orchestratorSessionId: string,
  ): Promise<ProjectSessionErrorsResponse> {
    return this.request<ProjectSessionErrorsResponse>(
      "GET",
      `/projects/${projectId}/sessions/${encodeURIComponent(orchestratorSessionId)}/errors`,
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

    const pathWithQuery = `${url.pathname}${url.search}`;
    logVerbose(`${method} ${pathWithQuery}`);
    if (options?.json !== undefined) {
      logVerbose(`request body: ${JSON.stringify(options.json)}`);
    }
    if (options?.body instanceof FormData) {
      logVerbose("request body: multipart/form-data (bundle upload)");
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

export function createApi(apiKey: string, apiBase: string): VoicethereApi {
  return new VoicethereApi(apiKey, apiBase);
}
