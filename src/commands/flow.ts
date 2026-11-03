import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validateFlow, validateMocks } from "@voicethere/agent/flow/core";

import { ApiError, type ProjectSourceFile } from "../lib/api.js";
import { logCommandInfo, logStep } from "../lib/command-log.js";
import { createApiFromCredentials } from "../lib/control-plane-auth.js";
import { requireCredentials } from "../lib/config.js";
import { resolveProjectId } from "../lib/project-config.js";

export const FLOW_FILENAME = "voicethere.flow.json";
export const FLOW_MOCKS_FILENAME = "voicethere.flow.mocks.json";
const FLOW_ENTRY_FILENAME = "agent.ts";

export const NO_FLOW_MESSAGE = "This project has no conversation flow";
export const FLOW_CONFLICT_MESSAGE =
  "The project changed; run flow export and try again";

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash + 1);
}

/** Finds a flow file whose sibling `agent.ts` mentions it. */
export function findFlowFiles(
  files: readonly ProjectSourceFile[],
): { flowPath: string; mocksPath: string } | null {
  const candidates = files
    .filter(
      (file) =>
        file.path === FLOW_FILENAME || file.path.endsWith(`/${FLOW_FILENAME}`),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const flow of candidates) {
    const dir = dirOf(flow.path);
    const entry = files.find((f) => f.path === `${dir}${FLOW_ENTRY_FILENAME}`);
    if (entry && entry.content.includes(FLOW_FILENAME)) {
      return { flowPath: flow.path, mocksPath: `${dir}${FLOW_MOCKS_FILENAME}` };
    }
  }
  return null;
}

async function resolveProject(
  explicit: string | undefined,
  startDir: string | undefined,
): Promise<string> {
  const id = explicit?.trim();
  if (id) return id;
  const resolved = await resolveProjectId(startDir ? { startDir } : undefined);
  return resolved.projectId;
}

export interface FlowExportOptions {
  projectId?: string;
  out?: string;
  startDir?: string;
}

export async function runFlowExport(
  options: FlowExportOptions = {},
): Promise<void> {
  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await resolveProject(options.projectId, options.startDir);

  logStep("Reading the conversation flow from VoiceThere");
  const remote = await api.getProjectSource(projectId);
  const located = findFlowFiles(remote.files);
  if (!located) {
    throw new Error(NO_FLOW_MESSAGE);
  }

  const outPath = resolve(options.out?.trim() || FLOW_FILENAME);
  await mkdir(dirname(outPath), { recursive: true });
  const flow = remote.files.find((f) => f.path === located.flowPath);
  await writeFile(outPath, flow?.content ?? "", "utf8");
  logCommandInfo(`wrote ${outPath}`);

  const mocks = remote.files.find((f) => f.path === located.mocksPath);
  if (mocks) {
    const mocksOut = join(dirname(outPath), FLOW_MOCKS_FILENAME);
    await writeFile(mocksOut, mocks.content, "utf8");
    logCommandInfo(`wrote ${mocksOut}`);
  }
  console.log(outPath);
}

export interface FlowImportOptions {
  projectId?: string;
  startDir?: string;
}

export async function runFlowImport(
  file: string,
  options: FlowImportOptions = {},
): Promise<void> {
  const path = file?.trim();
  if (!path) {
    throw new Error("Flow file required. Use: voicethere flow import <file>");
  }
  const text = await readFile(resolve(path), "utf8");
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }

  const result = validateFlow(doc);
  if (!result.ok) {
    const lines = result.errors.map(
      (e) => `${e.nodeId ?? "-"} ${e.path || "/"} ${e.code} ${e.message}`,
    );
    throw new Error(
      `The flow is invalid (${result.errors.length} error(s)):\n${lines.join("\n")}`,
    );
  }

  // The mocks file next to the local flow file goes up with it.
  let mocksText: string | undefined;
  try {
    mocksText = await readFile(
      join(dirname(resolve(path)), FLOW_MOCKS_FILENAME),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (mocksText !== undefined) {
    let mocksDoc: unknown;
    try {
      mocksDoc = JSON.parse(mocksText);
    } catch {
      throw new Error(`${FLOW_MOCKS_FILENAME} is not valid JSON`);
    }
    const checked = validateMocks(mocksDoc, result.flow!);
    if (!checked.ok) {
      const lines = checked.errors.map(
        (e) => `${e.nodeId ?? "-"} ${e.path || "/"} ${e.code} ${e.message}`,
      );
      throw new Error(
        `The mocks file is invalid (${checked.errors.length} error(s)):\n${lines.join("\n")}`,
      );
    }
  }

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  const projectId = await resolveProject(options.projectId, options.startDir);

  const remote = await api.getProjectSource(projectId);
  const located = findFlowFiles(remote.files);
  if (!located) {
    throw new Error(NO_FLOW_MESSAGE);
  }

  let files = remote.files.map((f) =>
    f.path === located.flowPath ? { ...f, content: text } : f,
  );
  if (mocksText !== undefined) {
    files = files.some((f) => f.path === located.mocksPath)
      ? files.map((f) =>
          f.path === located.mocksPath ? { ...f, content: mocksText } : f,
        )
      : [...files, { path: located.mocksPath, content: mocksText }];
  }
  logStep(`Uploading the flow (revision ${remote.revision})`);
  try {
    const updated = await api.putProjectSource(projectId, {
      entry_path: remote.entry_path,
      files,
      revision: remote.revision,
    });
    logCommandInfo(`source revision: ${updated.revision}`);
    console.log(String(updated.revision));
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error(FLOW_CONFLICT_MESSAGE);
    }
    throw error;
  }
}
