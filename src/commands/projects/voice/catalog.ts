import { createApi } from "../../../lib/api.js";
import { logStep, logVerbose } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";

export async function runProjectsVoiceCatalog(): Promise<void> {
  logStep("Fetching voice catalog");

  const credentials = await requireCredentials();
  const api = createApi(credentials.api_key, credentials.api_base);
  const catalog = await api.listVoiceModels();
  logVerbose(
    `catalog: ${catalog.stt_providers.length} STT providers, ${catalog.tts_providers.length} TTS providers`,
  );

  console.log(JSON.stringify(catalog, null, 2));
}
