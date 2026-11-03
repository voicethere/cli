import { logStep, logVerbose } from "../../../lib/command-log.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireCredentials } from "../../../lib/config.js";
import { requireProjectId } from "../../../lib/project-config.js";
import {
  readSecretFromStdin,
  type StdinLike,
} from "../../../lib/stdin-secret.js";

export interface ProjectsSecretsCreateOptions {
  name: string;
  value?: string;
  valueStdin?: boolean;
  stdin?: StdinLike;
  projectId?: string;
}

export async function runProjectsSecretsCreate(
  options: ProjectsSecretsCreateOptions,
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("secret name is required");
  }
  const hasPositional = options.value !== undefined && options.value !== "";
  if (hasPositional && options.valueStdin) {
    throw new Error(
      "pass the secret value as an argument or with --value-stdin, not both",
    );
  }
  if (!hasPositional && !options.valueStdin) {
    throw new Error(
      "secret value is required: pass it as an argument or with --value-stdin",
    );
  }
  let value: string;
  if (options.valueStdin) {
    value = await readSecretFromStdin(options.stdin ?? process.stdin, {
      ttyMessage:
        "Refusing to read the secret value from a terminal. Pipe it in, e.g.: printf '%s' \"$AGENT_API_KEY\" | voicethere projects secrets create <name> --value-stdin",
      emptyMessage: "secret value from stdin is empty",
    });
  } else {
    value = options.value as string;
    if (!value.trim()) {
      throw new Error("secret value is required");
    }
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Creating secret ${name} for project ${projectId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const secret = await api.createProjectSecret(projectId, name, value);
  console.log(JSON.stringify(secret, null, 2));
}
