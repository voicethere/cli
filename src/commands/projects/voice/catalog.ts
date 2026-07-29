import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import type { SherpaModelsResponse } from "../../../lib/api.js";

export interface ProjectsVoiceCatalogOptions {
  /** Emit full JSON (default: human-readable Sherpa tables). */
  json?: boolean;
}

function printModelTable(
  title: string,
  defaultId: string,
  models: Array<{
    id: string;
    label: string;
    language: string;
    bundle: string;
  }>,
): void {
  console.log(`\n${title} (default: ${defaultId})`);
  console.log("─".repeat(72));
  for (const m of models) {
    const mark = m.id === defaultId ? "*" : " ";
    console.log(
      `${mark} ${m.id.padEnd(18)} ${m.language.padEnd(4)} ${m.label}`,
    );
    console.log(`  ${"".padEnd(18)} bundle=${m.bundle}`);
  }
}

export async function runProjectsVoiceCatalog(
  options: ProjectsVoiceCatalogOptions = {},
): Promise<void> {
  logStep("Fetching voice catalog");

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);

  if (options.json) {
    const catalog = await api.listVoiceModels();
    logVerbose(
      `catalog: ${catalog.stt_providers.length} STT providers, ${catalog.tts_providers.length} TTS providers`,
    );
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  const sherpa = await api.listSherpaModels();
  logVerbose(
    `sherpa catalog: ${sherpa.stt_models.length} STT, ${sherpa.tts_models.length} TTS`,
  );
  printModelTable(
    "Sherpa STT models",
    sherpa.default_stt_model_id,
    sherpa.stt_models,
  );
  printModelTable(
    "Sherpa TTS models",
    sherpa.default_tts_model_id,
    sherpa.tts_models,
  );
  console.log(
    "\nSelect with: voicethere projects voice set --interactive\n" +
      "Or:          voicethere projects voice set --tts-model-id <id> --stt-model-id <id>\n" +
      "Full JSON:   voicethere projects voice catalog --json",
  );
}

export function formatSherpaModelChoiceLabel(model: {
  id: string;
  label: string;
  language: string;
  bundle: string;
}): string {
  return `${model.label} [${model.id}] (${model.language}) — ${model.bundle}`;
}

export function assertSherpaModelId(
  kind: "STT" | "TTS",
  modelId: string,
  catalog: SherpaModelsResponse,
): void {
  const list = kind === "STT" ? catalog.stt_models : catalog.tts_models;
  if (!list.some((m) => m.id === modelId)) {
    const ids = list.map((m) => m.id).join(", ");
    throw new Error(
      `Unknown Sherpa ${kind} model id ${JSON.stringify(modelId)}. Available: ${ids}`,
    );
  }
}
