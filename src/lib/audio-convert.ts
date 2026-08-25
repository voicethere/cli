import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const FFMPEG_MISSING_MESSAGE =
  "ffmpeg is required to convert session recordings. Reinstall @voicethere/cli (bundled ffmpeg missing) or set FFMPEG_PATH to a working ffmpeg binary.";

export type FfmpegConvertRunner = (
  ffmpegPath: string,
  args: readonly string[],
  input: Buffer,
) => Promise<Buffer>;

export async function resolveFfmpegPath(): Promise<string> {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) {
    await assertExecutable(fromEnv);
    return fromEnv;
  }

  const fromStatic = await tryResolveFfmpegStatic();
  if (fromStatic) {
    return fromStatic;
  }

  const fromPath = await findFfmpegOnPath();
  if (fromPath) {
    return fromPath;
  }

  throw new Error(FFMPEG_MISSING_MESSAGE);
}

async function assertExecutable(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.X_OK);
  } catch {
    throw new Error(
      `FFMPEG_PATH points to "${filePath}" but it is not executable`,
    );
  }
}

async function findFfmpegOnPath(): Promise<string | undefined> {
  const command = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await execFileAsync(command, ["ffmpeg"]);
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first;
  } catch {
    return undefined;
  }
}

async function tryResolveFfmpegStatic(): Promise<string | undefined> {
  try {
    const require = createRequire(import.meta.url);
    const staticPath = require("ffmpeg-static") as string | null;
    if (!staticPath || typeof staticPath !== "string") {
      return undefined;
    }
    await access(staticPath, constants.F_OK);
    return staticPath;
  } catch {
    return undefined;
  }
}

function buildFfmpegArgs(targetFormat: "wav" | "mp3"): string[] {
  const common = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "ogg",
    "-i",
    "pipe:0",
  ];
  if (targetFormat === "wav") {
    return [...common, "-f", "wav", "-acodec", "pcm_s16le", "pipe:1"];
  }
  return [...common, "-f", "mp3", "-acodec", "libmp3lame", "pipe:1"];
}

function defaultFfmpegConvertRunner(
  ffmpegPath: string,
  args: readonly string[],
  input: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(FFMPEG_MISSING_MESSAGE));
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        const output = Buffer.concat(stdoutChunks);
        if (output.byteLength <= 0) {
          reject(new Error("ffmpeg produced empty output"));
          return;
        }
        resolve(output);
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          stderr
            ? `ffmpeg failed with exit code ${code ?? "unknown"}: ${stderr}`
            : `ffmpeg failed with exit code ${code ?? "unknown"}`,
        ),
      );
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

export async function convertOpusRecording(
  input: Buffer,
  targetFormat: "wav" | "mp3",
  options: {
    ffmpegPath?: string;
    run?: FfmpegConvertRunner;
  } = {},
): Promise<Buffer> {
  const ffmpegPath = options.ffmpegPath ?? (await resolveFfmpegPath());
  const run = options.run ?? defaultFfmpegConvertRunner;
  const args = buildFfmpegArgs(targetFormat);
  return run(ffmpegPath, args, input);
}

export function buildFfmpegConvertArgs(
  targetFormat: "wav" | "mp3",
): string[] {
  return buildFfmpegArgs(targetFormat);
}
