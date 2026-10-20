/** Spellings of the built-in VoiceThere speech provider. */
const BUILT_IN_SPELLINGS = ["voicethere", "local-sherpa", "cluster-sherpa"];

/** Provider id the API lists for the built-in provider on current platforms. */
export const VOICETHERE_PROVIDER_ID = "voicethere";

/** Provider id older platforms list for the built-in provider. */
export const LEGACY_VOICETHERE_PROVIDER_ID = "local-sherpa";

export function isVoiceThereProvider(id: string | undefined): boolean {
  if (id === undefined) return false;
  return BUILT_IN_SPELLINGS.includes(id.trim().toLowerCase());
}

/** Trim the input; any built-in spelling becomes `voicethere`, others stay as typed. */
export function normalizeProviderInput(id: string): string {
  const trimmed = id.trim();
  return isVoiceThereProvider(trimmed) ? VOICETHERE_PROVIDER_ID : trimmed;
}
