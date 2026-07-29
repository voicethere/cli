import type { VoiceProviderId } from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import { isInteractive, promptChoice } from "../../../lib/prompt.js";
import {
  assertSherpaModelId,
  formatSherpaModelChoiceLabel,
} from "./catalog.js";

export function assertVoiceProviders(
  sttProvider: string,
  ttsProvider: string,
  allowedStt?: ReadonlySet<string>,
  allowedTts?: ReadonlySet<string>,
): void {
  const sttOk = allowedStt
    ? allowedStt.has(sttProvider)
    : DEFAULT_STT_PROVIDERS.has(sttProvider);
  const ttsOk = allowedTts
    ? allowedTts.has(ttsProvider)
    : DEFAULT_TTS_PROVIDERS.has(ttsProvider);
  if (!sttOk) {
    throw new Error(`Unknown STT provider: ${sttProvider}`);
  }
  if (!ttsOk) {
    throw new Error(`Unknown TTS provider: ${ttsProvider}`);
  }
}

/** Fallback when catalog fetch is unavailable (tests / offline). */
const DEFAULT_STT_PROVIDERS = new Set([
  "local-sherpa",
  "openai",
  "deepgram",
  "assemblyai",
  "google",
]);

const DEFAULT_TTS_PROVIDERS = new Set([
  "local-sherpa",
  "openai",
  "elevenlabs",
  "cartesia",
  "google",
]);

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
  /** Prompt to pick STT/TTS model ids from GET /voice/sherpa-models. */
  interactive?: boolean;
}

export async function runProjectsVoiceSet(
  options: ProjectsVoiceSetOptions,
): Promise<void> {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Updating voice settings for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const current = await api.getProjectVoiceSettings(projectId);
  const voiceCatalog = await api.listVoiceModels();
  const sherpa = await api.listSherpaModels();

  const allowedStt = new Set(voiceCatalog.stt_providers.map((p) => p.id));
  const allowedTts = new Set(voiceCatalog.tts_providers.map((p) => p.id));

  let stt_provider = (options.sttProvider?.trim() ||
    current.stt_provider) as VoiceProviderId;
  let tts_provider = (options.ttsProvider?.trim() ||
    current.tts_provider) as VoiceProviderId;

  const wantInteractive = options.interactive === true;

  if (wantInteractive) {
    if (!isInteractive()) {
      throw new Error(
        "projects voice set --interactive requires a TTY. Pass --stt-model-id / --tts-model-id instead.",
      );
    }
    stt_provider = (await promptChoice(
      "STT provider",
      voiceCatalog.stt_providers.map((p) => ({
        value: p.id,
        label: `${p.label} [${p.id}]`,
      })),
    )) as VoiceProviderId;
    tts_provider = (await promptChoice(
      "TTS provider",
      voiceCatalog.tts_providers.map((p) => ({
        value: p.id,
        label: `${p.label} [${p.id}]`,
      })),
    )) as VoiceProviderId;
  }

  assertVoiceProviders(stt_provider, tts_provider, allowedStt, allowedTts);

  let stt_model_id = options.sttModelId?.trim() || current.stt_model_id;
  let tts_model_id = options.ttsModelId?.trim() || current.tts_model_id;

  if (wantInteractive) {
    if (stt_provider === "local-sherpa") {
      stt_model_id = await promptChoice(
        "Sherpa STT model",
        sherpa.stt_models.map((m) => ({
          value: m.id,
          label: formatSherpaModelChoiceLabel(m),
        })),
      );
    }
    if (tts_provider === "local-sherpa") {
      tts_model_id = await promptChoice(
        "Sherpa TTS model",
        sherpa.tts_models.map((m) => ({
          value: m.id,
          label: formatSherpaModelChoiceLabel(m),
        })),
      );
    }
  }

  if (stt_provider === "local-sherpa") {
    assertSherpaModelId("STT", stt_model_id, sherpa);
  }
  if (tts_provider === "local-sherpa") {
    assertSherpaModelId("TTS", tts_model_id, sherpa);
  }

  logVerbose(
    `voice set stt=${stt_provider}/${stt_model_id} tts=${tts_provider}/${tts_model_id}`,
  );

  const next = await api.updateProjectVoiceSettings(projectId, {
    stt_provider,
    tts_provider,
    stt_model_id,
    tts_model_id,
    stt_model: options.sttModel?.trim() || current.stt_model,
    stt_language: options.sttLanguage?.trim() || current.stt_language,
    tts_model: options.ttsModel?.trim() || current.tts_model,
    tts_voice: options.ttsVoice?.trim() || current.tts_voice,
  });

  console.log(JSON.stringify(next, null, 2));
}
