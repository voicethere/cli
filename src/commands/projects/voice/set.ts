import type { VoiceProviderId } from "../../../lib/api.js";
import { createApi } from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";

const STT_PROVIDERS = new Set([
  "local-sherpa",
  "openai",
  "deepgram",
  "assemblyai",
  "google",
]);

const TTS_PROVIDERS = new Set([
  "local-sherpa",
  "openai",
  "elevenlabs",
  "cartesia",
  "google",
]);

export function assertVoiceProviders(
  sttProvider: string,
  ttsProvider: string,
): void {
  if (!STT_PROVIDERS.has(sttProvider)) {
    throw new Error(`Unknown STT provider: ${sttProvider}`);
  }
  if (!TTS_PROVIDERS.has(ttsProvider)) {
    throw new Error(`Unknown TTS provider: ${ttsProvider}`);
  }
}

export interface ProjectsVoiceSetOptions {
  projectId?: string;
  sttProvider?: string;
  ttsProvider?: string;
  sttModelId?: string;
  ttsModelId?: string;
  sttModel?: string;
  sttLanguage?: string;
  ttsModel?: string;
  ttsVoice?: string;
}

export async function runProjectsVoiceSet(
  options: ProjectsVoiceSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Updating voice settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const current = await api.getProjectVoiceSettings(projectId);

  const stt_provider = (options.sttProvider?.trim() ||
    current.stt_provider) as VoiceProviderId;
  const tts_provider = (options.ttsProvider?.trim() ||
    current.tts_provider) as VoiceProviderId;

  assertVoiceProviders(stt_provider, tts_provider);

  const next = await api.updateProjectVoiceSettings(projectId, {
    stt_provider,
    tts_provider,
    stt_model_id: options.sttModelId?.trim() || current.stt_model_id,
    tts_model_id: options.ttsModelId?.trim() || current.tts_model_id,
    stt_model: options.sttModel?.trim() || current.stt_model,
    stt_language: options.sttLanguage?.trim() || current.stt_language,
    tts_model: options.ttsModel?.trim() || current.tts_model,
    tts_voice: options.ttsVoice?.trim() || current.tts_voice,
  });

  console.log(JSON.stringify(next, null, 2));
}
