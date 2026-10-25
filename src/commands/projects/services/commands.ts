import type {
  ProjectServiceInput,
  ProjectServiceSetResponse,
  ProjectServiceView,
} from "../../../lib/api.js";
import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";
import { isInteractive, promptYesNo } from "../../../lib/prompt.js";
import {
  parseBool,
  parseEnvFlags,
  parseEnvFromProject,
  parseHealthFlag,
  parsePortFlag,
  parsePositiveInt,
  parseRunMode,
} from "./parse.js";

export const REDEPLOY_HINT = "Run voicethere deploy to apply.";

interface ProjectOption {
  projectId?: string;
}

async function context(options: ProjectOption) {
  const projectId = options.projectId?.trim() || (await requireProjectId());
  const credentials = await requireCredentials();
  return { projectId, api: createApiFromCredentials(credentials) };
}

export async function runProjectsServicesList(
  options: ProjectOption & { json?: boolean } = {},
): Promise<void> {
  const { projectId, api } = await context(options);
  logStep(`Listing services for project ${projectId}`);
  const result = await api.listProjectServices(projectId);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.services.length === 0) {
    console.log(`No services (max ${result.maxServices}).`);
    return;
  }
  for (const service of result.services) {
    console.log(
      `${service.name}\t${service.image ?? ""}\t${service.runMode ?? ""}\t${
        service.enabled === false ? "disabled" : "enabled"
      }`,
    );
  }
}

export async function runProjectsServicesShow(
  options: ProjectOption & { name: string },
): Promise<void> {
  const { projectId, api } = await context(options);
  const service = await api.getProjectService(projectId, options.name.trim());
  console.log(JSON.stringify(service, null, 2));
}

export interface ProjectsServicesSetOptions extends ProjectOption {
  name: string;
  image?: string;
  registryCredential?: string;
  port?: string[];
  health?: string;
  env?: string[];
  envFromProject?: string;
  envKey?: string[];
  secretKey?: string[];
  cpu?: string;
  memory?: string;
  runMode?: string;
  idleStop?: string;
  startTimeout?: string;
  enabled?: string;
  command?: string[];
  arg?: string[];
}

const INPUT_KEYS: Array<keyof ProjectServiceInput> = [
  "image",
  "registryCredential",
  "ports",
  "command",
  "args",
  "envPlain",
  "envFromProject",
  "envKeys",
  "secretKeys",
  "cpuMillis",
  "memoryMib",
  "runMode",
  "idleStopMinutes",
  "health",
  "startTimeoutS",
  "enabled",
];

function inputFromView(view: ProjectServiceView): Partial<ProjectServiceInput> {
  const out: Record<string, unknown> = {};
  for (const key of INPUT_KEYS) {
    const value = view[key];
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return out as Partial<ProjectServiceInput>;
}

/** Flags that were given, as a partial service input. Throws on bad values. */
export function inputFromFlags(
  options: ProjectsServicesSetOptions,
): Partial<ProjectServiceInput> {
  const out: Partial<ProjectServiceInput> = {};
  if (options.image !== undefined) out.image = options.image.trim();
  if (options.registryCredential !== undefined) {
    out.registryCredential = options.registryCredential.trim();
  }
  if (options.port?.length) out.ports = options.port.map(parsePortFlag);
  if (options.health !== undefined)
    out.health = parseHealthFlag(options.health);
  if (options.env?.length) out.envPlain = parseEnvFlags(options.env);
  if (options.envFromProject !== undefined) {
    out.envFromProject = parseEnvFromProject(options.envFromProject);
  }
  if (options.envKey?.length) out.envKeys = options.envKey;
  if (options.secretKey?.length) out.secretKeys = options.secretKey;
  if (options.cpu !== undefined) {
    out.cpuMillis = parsePositiveInt("--cpu", options.cpu);
  }
  if (options.memory !== undefined) {
    out.memoryMib = parsePositiveInt("--memory", options.memory);
  }
  if (options.runMode !== undefined)
    out.runMode = parseRunMode(options.runMode);
  if (options.idleStop !== undefined) {
    out.idleStopMinutes = parsePositiveInt("--idle-stop", options.idleStop);
  }
  if (options.startTimeout !== undefined) {
    out.startTimeoutS = parsePositiveInt(
      "--start-timeout",
      options.startTimeout,
    );
  }
  if (options.enabled !== undefined) {
    out.enabled = parseBool("--enabled", options.enabled);
  }
  if (options.command?.length) out.command = options.command;
  if (options.arg?.length) out.args = options.arg;
  return out;
}

export async function runProjectsServicesSet(
  options: ProjectsServicesSetOptions,
): Promise<ProjectServiceSetResponse> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("service name is required");
  }
  const flags = inputFromFlags(options);
  const { projectId, api } = await context(options);

  const existing = await findExisting(api, projectId, name);
  const merged: Partial<ProjectServiceInput> = {
    ...(existing ? inputFromView(existing) : {}),
    ...flags,
  };
  if (merged.envFromProject === "all") {
    merged.envKeys = [];
    merged.secretKeys = [];
  }

  if (!existing) {
    if (!merged.image) {
      throw new Error("--image is required when creating a service");
    }
    if (!merged.health) {
      throw new Error("--health is required when creating a service");
    }
  }
  if (!merged.ports) {
    merged.ports = [];
  }

  logStep(`${existing ? "Updating" : "Creating"} service ${name}`);
  const result = await api.putProjectService(
    projectId,
    name,
    merged as ProjectServiceInput,
  );
  console.log(JSON.stringify(result.service, null, 2));
  if (result.requiresRedeploy) {
    console.log(REDEPLOY_HINT);
  }
  return result;
}

async function findExisting(
  api: Awaited<ReturnType<typeof context>>["api"],
  projectId: string,
  name: string,
): Promise<ProjectServiceView | null> {
  const list = await api.listProjectServices(projectId);
  return list.services.find((s) => s.name === name) ?? null;
}

export async function runProjectsServicesDelete(
  options: ProjectOption & { name: string; yes?: boolean },
): Promise<void> {
  const name = options.name.trim();
  if (!name) {
    throw new Error("service name is required");
  }
  if (!options.yes) {
    if (!isInteractive()) {
      throw new Error(
        `Refusing to delete service "${name}" without confirmation. Re-run in a TTY or pass --yes.`,
      );
    }
    if (!(await promptYesNo(`Delete service "${name}"?`))) {
      console.log("Cancelled.");
      return;
    }
  }
  const { projectId, api } = await context(options);
  logStep(`Deleting service ${name} from project ${projectId}`);
  await api.deleteProjectService(projectId, name);
  console.log(`Deleted service ${name}`);
}

export async function runProjectsServicesRotateToken(
  options: ProjectOption & { name: string },
): Promise<void> {
  const { projectId, api } = await context(options);
  const result = await api.rotateProjectServiceToken(
    projectId,
    options.name.trim(),
  );
  console.log(`Token version: ${result.tokenVersion}`);
  console.log(
    result.previousValidUntil
      ? `Previous token valid until: ${result.previousValidUntil}`
      : "Previous token valid until: (none)",
  );
}
