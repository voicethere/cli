import { logCommandInfo } from "../lib/command-log.js";
import {
  DEFAULT_API_BASE,
  getCredentialsPath,
  writeCredentials,
} from "../lib/config.js";

export interface LoginOptions {
  apiKey: string;
  apiBase?: string;
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("--api-key is required");
  }

  const apiBase = (options.apiBase?.trim() || DEFAULT_API_BASE).replace(
    /\/$/,
    "",
  );

  const credentialsPath = getCredentialsPath();
  logCommandInfo(`credentials: ${credentialsPath}`);

  await writeCredentials({
    api_key: apiKey,
    api_base: apiBase,
  });

  console.log(`Saved credentials to ${credentialsPath} (api_base=${apiBase})`);
}
