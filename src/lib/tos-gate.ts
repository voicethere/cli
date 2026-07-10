import type { ApiErrorBody } from "./api.js";

export const TOS_NOT_ACCEPTED_CODE = "NWRTC_TOS_NOT_ACCEPTED";

export function isTosNotAcceptedError(body?: ApiErrorBody): boolean {
  return body?.error?.code === TOS_NOT_ACCEPTED_CODE;
}

export function formatTosNotAcceptedMessage(
  body: ApiErrorBody | undefined,
  fallbackMessage: string,
): string {
  const acceptUrl = extractAcceptUrl(body?.error?.message ?? fallbackMessage);
  const lines = [
    "Terms of Service must be accepted before using the VoiceThere CLI or API.",
  ];
  if (acceptUrl) {
    lines.push(`Open ${acceptUrl} in your browser, sign in, and click Accept.`);
  } else {
    lines.push(fallbackMessage);
  }
  return lines.join("\n");
}

function extractAcceptUrl(message: string): string | null {
  const match = /(https?:\/\/\S+\/accept-tos)/i.exec(message);
  return match?.[1] ?? null;
}

export function apiBaseToAcceptTosUrl(apiBase: string): string {
  const url = new URL(apiBase.replace(/\/$/, ""));
  if (url.pathname.endsWith("/api/v1")) {
    url.pathname = url.pathname.replace(/\/api\/v1$/, "");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/accept-tos`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
