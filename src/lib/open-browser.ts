import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type OpenBrowserFn = (url: string) => Promise<void>;

function normalizeBrowserUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid verification URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported verification URL protocol");
  }

  return parsed.toString();
}

/** Cross-platform URL open (macOS `open`, Windows `explorer`, Linux `xdg-open`). */
export async function openBrowser(url: string): Promise<void> {
  const safeUrl = normalizeBrowserUrl(url);
  const platform = process.platform;
  if (platform === "darwin") {
    await execFileAsync("open", [safeUrl]);
    return;
  }
  if (platform === "win32") {
    await execFileAsync("explorer.exe", [safeUrl]);
    return;
  }
  await execFileAsync("xdg-open", [safeUrl]);
}
