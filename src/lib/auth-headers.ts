/** Must match platform `USER_ORG_ID_HEADER`. */
export const USER_ORG_ID_HEADER = "x-voicethere-org-id";

export function isUserApiKeyToken(token: string): boolean {
  return token.startsWith("vthu_");
}

export function isLegacyApiKeyToken(token: string): boolean {
  return token.startsWith("vth_") || token.startsWith("vthc_");
}
