import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type OpenBrowserFn = (url: string) => Promise<void>;

/** Cross-platform URL open (macOS `open`, Windows `cmd start`, Linux `xdg-open`). */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  if (platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }
  await execFileAsync("xdg-open", [url]);
}
