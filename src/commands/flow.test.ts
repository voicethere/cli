import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api.js";
import {
  FLOW_CONFLICT_MESSAGE,
  NO_FLOW_MESSAGE,
  findFlowFiles,
  runFlowExport,
  runFlowImport,
} from "./flow.js";

const getProjectSource = vi.fn();
const putProjectSource = vi.fn();
const requireCredentials = vi.fn();

vi.mock("../lib/control-plane-auth.js", () => ({
  createApiFromCredentials: vi.fn(() => ({
    getProjectSource,
    putProjectSource,
  })),
}));

vi.mock("../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../lib/project-config.js", () => ({
  resolveProjectId: vi.fn(async () => ({
    projectId: "proj-cfg",
    source: "config",
    configPath: "",
  })),
}));

const VALID_FLOW = {
  version: 1,
  start: "greet",
  models: {
    default: {
      provider: "openrouter",
      model: "anthropic/claude-haiku-5.5",
      apiKeySecret: "AGENT_OPENROUTER_API_KEY",
    },
  },
  nodes: [
    { id: "greet", type: "speak", text: "Hello", next: "bye" },
    { id: "bye", type: "end", reason: "done" },
  ],
};
const AGENT_TS = 'import flow from "./voicethere.flow.json";\n';

function workspace(extra: { path: string; content: string }[] = []) {
  return {
    project_id: "proj-cfg",
    entry_path: "agent.ts",
    revision: 7,
    files: [
      { path: "agent.ts", content: AGENT_TS },
      {
        path: "voicethere.flow.json",
        content: `${JSON.stringify({ ...VALID_FLOW, nodes: [] })}\n`,
      },
      ...extra,
    ],
  };
}

describe("flow export/import", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(
      tmpdir(),
      `voicethere-flow-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
    getProjectSource.mockReset();
    putProjectSource.mockReset();
    requireCredentials.mockReset();
    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.io/api/v1",
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("findFlowFiles needs an agent.ts that mentions the flow", () => {
    expect(
      findFlowFiles([
        { path: "voicethere.flow.json", content: "{}" },
        { path: "agent.ts", content: "export {};" },
      ]),
    ).toBeNull();
    expect(
      findFlowFiles([
        { path: "bot/voicethere.flow.json", content: "{}" },
        { path: "bot/agent.ts", content: AGENT_TS },
      ]),
    ).toEqual({
      flowPath: "bot/voicethere.flow.json",
      mocksPath: "bot/voicethere.flow.mocks.json",
    });
  });

  it("export writes the flow and the mocks file", async () => {
    getProjectSource.mockResolvedValue(
      workspace([{ path: "voicethere.flow.mocks.json", content: '{"m":1}\n' }]),
    );
    const out = join(dir, "sub", "my.flow.json");
    await runFlowExport({ out });
    expect(getProjectSource).toHaveBeenCalledWith("proj-cfg");
    expect(await readFile(out, "utf8")).toContain('"version":1');
    expect(
      await readFile(join(dir, "sub", "voicethere.flow.mocks.json"), "utf8"),
    ).toBe('{"m":1}\n');
  });

  it("export of a project without a flow fails", async () => {
    getProjectSource.mockResolvedValue({
      ...workspace(),
      files: [{ path: "agent.ts", content: "export {};" }],
    });
    await expect(runFlowExport({ out: join(dir, "x.json") })).rejects.toThrow(
      NO_FLOW_MESSAGE,
    );
  });

  it("import of an invalid flow makes no request", async () => {
    const file = join(dir, "bad.json");
    await writeFile(
      file,
      JSON.stringify({ version: 1, start: "nope", nodes: [] }),
    );
    await expect(runFlowImport(file)).rejects.toThrow(/The flow is invalid/);
    await expect(runFlowImport(file)).rejects.toThrow(
      "- /models FLOW_SCHEMA is required",
    );
    expect(getProjectSource).not.toHaveBeenCalled();
    expect(putProjectSource).not.toHaveBeenCalled();
    expect(requireCredentials).not.toHaveBeenCalled();
  });

  it("import of non-JSON makes no request", async () => {
    const file = join(dir, "bad.json");
    await writeFile(file, "{not json");
    await expect(runFlowImport(file)).rejects.toThrow(/not valid JSON/);
    expect(getProjectSource).not.toHaveBeenCalled();
  });

  it("import puts the flow with the revision it read", async () => {
    const file = join(dir, "voicethere.flow.json");
    const text = `${JSON.stringify(VALID_FLOW, null, 2)}\n`;
    await writeFile(file, text);
    getProjectSource.mockResolvedValue(workspace());
    putProjectSource.mockResolvedValue({ ...workspace(), revision: 8 });

    await runFlowImport(file, { projectId: "proj-x" });

    expect(getProjectSource).toHaveBeenCalledWith("proj-x");
    expect(putProjectSource).toHaveBeenCalledWith("proj-x", {
      entry_path: "agent.ts",
      revision: 7,
      files: [
        { path: "agent.ts", content: AGENT_TS },
        { path: "voicethere.flow.json", content: text },
      ],
    });
    expect(console.log).toHaveBeenCalledWith("8");
  });

  it("import uploads the sibling mocks file", async () => {
    const file = join(dir, "voicethere.flow.json");
    const text = `${JSON.stringify(VALID_FLOW)}\n`;
    const mocks = `${JSON.stringify({ version: 1, nodes: {} })}\n`;
    await writeFile(file, text);
    await writeFile(join(dir, "voicethere.flow.mocks.json"), mocks);
    // Replaces an existing project mocks file.
    getProjectSource.mockResolvedValue(
      workspace([{ path: "voicethere.flow.mocks.json", content: "old" }]),
    );
    putProjectSource.mockResolvedValue({ ...workspace(), revision: 8 });
    await runFlowImport(file);
    expect(putProjectSource.mock.calls[0]![1].files).toEqual([
      { path: "agent.ts", content: AGENT_TS },
      { path: "voicethere.flow.json", content: text },
      { path: "voicethere.flow.mocks.json", content: mocks },
    ]);

    // Adds it when the project has none.
    putProjectSource.mockClear();
    getProjectSource.mockResolvedValue(workspace());
    await runFlowImport(file);
    expect(putProjectSource.mock.calls[0]![1].files).toContainEqual({
      path: "voicethere.flow.mocks.json",
      content: mocks,
    });
  });

  it("import accepts a mocks file with route path none and a classifier error case", async () => {
    const routeFlow = {
      ...VALID_FLOW,
      start: "pick",
      nodes: [
        {
          id: "pick",
          type: "route",
          paths: [{ id: "billing", examples: ["my invoice"], next: "bye" }],
          onNone: "bye",
          onError: "bye",
        },
        { id: "bye", type: "end", reason: "done" },
      ],
    };
    const file = join(dir, "voicethere.flow.json");
    const text = `${JSON.stringify(routeFlow)}\n`;
    const mocks = `${JSON.stringify({
      version: 1,
      nodes: {
        pick: [
          { name: "no match", route: { path: "none" } },
          {
            name: "classifier did not call",
            route: { error: "LLM_CLASSIFIER_NO_CALL" },
          },
        ],
      },
    })}\n`;
    await writeFile(file, text);
    await writeFile(join(dir, "voicethere.flow.mocks.json"), mocks);
    getProjectSource.mockResolvedValue(workspace());
    putProjectSource.mockResolvedValue({ ...workspace(), revision: 8 });
    await runFlowImport(file);
    expect(putProjectSource.mock.calls[0]![1].files).toContainEqual({
      path: "voicethere.flow.mocks.json",
      content: mocks,
    });
  });

  it("import with invalid mocks makes no request", async () => {
    const file = join(dir, "voicethere.flow.json");
    await writeFile(file, JSON.stringify(VALID_FLOW));
    await writeFile(
      join(dir, "voicethere.flow.mocks.json"),
      JSON.stringify({ version: 1, nodes: { ghost: [] } }),
    );
    await expect(runFlowImport(file)).rejects.toThrow(
      /The mocks file is invalid/,
    );
    expect(getProjectSource).not.toHaveBeenCalled();
    expect(putProjectSource).not.toHaveBeenCalled();
  });

  it("import without a local mocks file leaves project mocks unchanged", async () => {
    const file = join(dir, "voicethere.flow.json");
    await writeFile(file, JSON.stringify(VALID_FLOW));
    getProjectSource.mockResolvedValue(
      workspace([{ path: "voicethere.flow.mocks.json", content: "keep" }]),
    );
    putProjectSource.mockResolvedValue({ ...workspace(), revision: 8 });
    await runFlowImport(file);
    expect(putProjectSource.mock.calls[0]![1].files).toContainEqual({
      path: "voicethere.flow.mocks.json",
      content: "keep",
    });
  });

  it("import maps a 409 to the export-and-retry message", async () => {
    const file = join(dir, "f.json");
    await writeFile(file, JSON.stringify(VALID_FLOW));
    getProjectSource.mockResolvedValue(workspace());
    putProjectSource.mockRejectedValue(
      new ApiError(409, "conflict", { error: { code: "SOURCE_CONFLICT" } }),
    );
    await expect(runFlowImport(file)).rejects.toThrow(FLOW_CONFLICT_MESSAGE);
  });

  it("import into a project without a flow fails without a put", async () => {
    const file = join(dir, "f.json");
    await writeFile(file, JSON.stringify(VALID_FLOW));
    getProjectSource.mockResolvedValue({
      ...workspace(),
      files: [{ path: "agent.ts", content: "export {};" }],
    });
    await expect(runFlowImport(file)).rejects.toThrow(NO_FLOW_MESSAGE);
    expect(putProjectSource).not.toHaveBeenCalled();
  });

  it("import requires a file argument", async () => {
    await expect(runFlowImport("  ")).rejects.toThrow(/Flow file required/);
  });
});

const distCli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

describe.skipIf(!existsSync(distCli) && !process.env.CI)(
  "flow command list and help",
  () => {
    const help = (...args: string[]) =>
      execFileSync(process.execPath, [distCli, ...args, "--help"], {
        encoding: "utf8",
      });

    it("lists flow in the top-level help", () => {
      expect(help()).toMatch(/^\s+flow\b/m);
    });

    it("lists export and import with their options", () => {
      const text = help("flow");
      expect(text).toMatch(/export\b/);
      expect(text).toMatch(/import\b/);
      expect(help("flow", "export")).toMatch(/--out <path>/);
      expect(help("flow", "export")).toMatch(/--project <id>/);
      expect(help("flow", "import")).toMatch(/<file>/);
    });
  },
);
