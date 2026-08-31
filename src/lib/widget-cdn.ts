/**
 * Resolve the public widget config CDN origin from the control-plane API base.
 * Override with `VOICETHERE_WIDGET_CDN_BASE` or `--cdn-base`.
 */
export function resolveWidgetCdnBase(input: {
  apiBase: string;
  envOverride?: string;
  cliOverride?: string;
}): string {
  const cli = input.cliOverride?.trim();
  if (cli) {
    return cli.replace(/\/$/, "");
  }

  const env = input.envOverride ?? process.env.VOICETHERE_WIDGET_CDN_BASE;
  if (env?.trim()) {
    return env.trim().replace(/\/$/, "");
  }

  let host: string;
  try {
    host = new URL(input.apiBase).hostname;
  } catch {
    throw new Error(`Invalid api_base URL: ${input.apiBase}`);
  }

  if (host === "app.voicethere.dev") {
    return "https://cdn.voicethere.dev";
  }
  if (host === "app.voicethere.io") {
    return "https://cdn.voicethere.io";
  }
  if (host.startsWith("app.")) {
    return `https://cdn.${host.slice(4)}`;
  }

  throw new Error(
    `Cannot derive widget CDN base from api_base host "${host}". Set VOICETHERE_WIDGET_CDN_BASE or use --cdn-base.`,
  );
}

export function buildWidgetConfigUrls(
  cdnBase: string,
  publicId: string,
  revision?: number,
): { stable: string; immutable?: string } {
  const base = cdnBase.replace(/\/$/, "");
  const stable = `${base}/widgets/${publicId}/config.json`;
  const immutable =
    revision != null && Number.isFinite(revision) && revision > 0
      ? `${base}/widgets/${publicId}/r${revision}.json`
      : undefined;
  return { stable, immutable };
}
