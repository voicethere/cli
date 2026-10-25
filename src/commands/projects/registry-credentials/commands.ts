import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";

interface ProjectOption {
  projectId?: string;
}

async function context(options: ProjectOption) {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const credentials = await requireCredentials();
  return { projectId, api: createApiFromCredentials(credentials) };
}

export async function runRegistryCredentialsList(
  options: ProjectOption & { json?: boolean } = {},
): Promise<void> {
  const { projectId, api } = await context(options);
  logStep(`Listing registry credentials for project ${projectId}`);
  const result = await api.listRegistryCredentials(projectId);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.credentials.length === 0) {
    console.log("No registry credentials.");
    return;
  }
  for (const entry of result.credentials) {
    console.log(
      `${entry.name}\t${entry.registryHost}\t${entry.username}\t${entry.updatedAt}`,
    );
  }
}

export interface StdinLike extends AsyncIterable<Buffer | string> {
  isTTY?: boolean;
}

export async function readPasswordFromStdin(
  stdin: StdinLike = process.stdin,
): Promise<string> {
  if (stdin.isTTY) {
    throw new Error(
      "Refusing to read the password from a terminal. Pipe it in, e.g.: printf '%s' \"$REGISTRY_TOKEN\" | voicethere projects registry-credentials set <name> --host <registry> --username <user> --password-stdin",
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const password = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
  if (!password) {
    throw new Error("password from stdin is empty");
  }
  return password;
}

export interface RegistryCredentialsSetOptions extends ProjectOption {
  name: string;
  host?: string;
  username?: string;
  passwordStdin?: boolean;
  stdin?: StdinLike;
}

export async function runRegistryCredentialsSet(
  options: RegistryCredentialsSetOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) throw new Error("credential name is required");
  if (!options.host?.trim()) throw new Error("--host is required");
  if (!options.username?.trim()) throw new Error("--username is required");
  if (!options.passwordStdin) {
    throw new Error(
      "--password-stdin is required: the password is read from stdin only",
    );
  }
  const password = await readPasswordFromStdin(options.stdin);
  const { projectId, api } = await context(options);
  logStep(`Saving registry credential ${name} for project ${projectId}`);
  await api.putRegistryCredential(projectId, name, {
    registryHost: options.host.trim(),
    username: options.username.trim(),
    password,
  });
  console.log(`Saved registry credential ${name}`);
}

export async function runRegistryCredentialsDelete(
  options: ProjectOption & { name: string },
): Promise<void> {
  const name = options.name.trim();
  if (!name) throw new Error("credential name is required");
  const { projectId, api } = await context(options);
  logStep(`Deleting registry credential ${name} from project ${projectId}`);
  await api.deleteRegistryCredential(projectId, name);
  console.log(`Deleted registry credential ${name}`);
}
