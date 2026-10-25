import type {
  ProjectServiceEnvFromProject,
  ProjectServiceHealth,
  ProjectServicePort,
  ProjectServiceRunMode,
} from "../../../lib/api.js";

/** `--port mcp:8080` -> `{ name: "mcp", port: 8080 }`. */
export function parsePortFlag(raw: string): ProjectServicePort {
  const match = /^([^:\s]+):(\d+)$/.exec(raw.trim());
  if (!match) {
    throw new Error(
      `Invalid --port "${raw}": expected <name:port>, e.g. mcp:8080`,
    );
  }
  const port = Number.parseInt(match[2]!, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid --port "${raw}": port must be 1-65535`);
  }
  return { name: match[1]!, port };
}

/** `--health http:/healthz:8080` or `--health tcp:8080`. */
export function parseHealthFlag(raw: string): ProjectServiceHealth {
  const value = raw.trim();
  const tcp = /^tcp:(\d+)$/.exec(value);
  if (tcp) {
    return { type: "tcp", port: checkPort(raw, tcp[1]!) };
  }
  const http = /^http:(\/[^:]*):(\d+)$/.exec(value);
  if (http) {
    return { type: "http", path: http[1]!, port: checkPort(raw, http[2]!) };
  }
  throw new Error(
    `Invalid --health "${raw}": expected http:<path>:<port> (path starts with /) or tcp:<port>`,
  );
}

function checkPort(raw: string, digits: string): number {
  const port = Number.parseInt(digits, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid --health "${raw}": port must be 1-65535`);
  }
  return port;
}

/** `--env KEY=VALUE` (repeatable). */
export function parseEnvFlags(values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of values) {
    const index = raw.indexOf("=");
    if (index < 1) {
      throw new Error(`Invalid --env "${raw}": expected KEY=VALUE`);
    }
    out[raw.slice(0, index)] = raw.slice(index + 1);
  }
  return out;
}

export function parseEnvFromProject(raw: string): ProjectServiceEnvFromProject {
  if (raw === "none" || raw === "selected" || raw === "all") {
    return raw;
  }
  throw new Error(
    `Invalid --env-from-project "${raw}": expected none, selected or all`,
  );
}

export function parseRunMode(raw: string): ProjectServiceRunMode {
  if (raw === "on_demand" || raw === "always_on") {
    return raw;
  }
  throw new Error(
    `Invalid --run-mode "${raw}": expected on_demand or always_on`,
  );
}

export function parsePositiveInt(flag: string, raw: string): number {
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`Invalid ${flag} "${raw}": expected a positive integer`);
  }
  return Number.parseInt(raw.trim(), 10);
}

export function parseBool(flag: string, raw: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid ${flag} "${raw}": expected true or false`);
}
