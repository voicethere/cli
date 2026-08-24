import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFfmpegConvertArgs,
  convertOpusRecording,
  FFMPEG_MISSING_MESSAGE,
  resolveFfmpegPath,
} from "./audio-convert.js";

const execFileAsync = vi.hoisted(() => vi.fn());
const accessMock = vi.hoisted(() => vi.fn());

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:util")>();
  return {
    ...actual,
    promisify: () => execFileAsync,
  };
});

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => accessMock(...args),
}));

describe("audio-convert", () => {
  beforeEach(() => {
    execFileAsync.mockReset();
    accessMock.mockReset();
    delete process.env.FFMPEG_PATH;
    accessMock.mockResolvedValue(undefined);
  });

  describe("buildFfmpegConvertArgs", () => {
    it("builds wav conversion args", () => {
      expect(buildFfmpegConvertArgs("wav")).toEqual([
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "ogg",
        "-i",
        "pipe:0",
        "-f",
        "wav",
        "-acodec",
        "pcm_s16le",
        "pipe:1",
      ]);
    });

    it("builds mp3 conversion args", () => {
      expect(buildFfmpegConvertArgs("mp3")).toEqual([
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "ogg",
        "-i",
        "pipe:0",
        "-f",
        "mp3",
        "-acodec",
        "libmp3lame",
        "pipe:1",
      ]);
    });
  });

  describe("resolveFfmpegPath", () => {
    it("uses FFMPEG_PATH when set", async () => {
      process.env.FFMPEG_PATH = "/opt/ffmpeg";

      await expect(resolveFfmpegPath()).resolves.toBe("/opt/ffmpeg");
      expect(accessMock).toHaveBeenCalledWith("/opt/ffmpeg", expect.any(Number));
      expect(execFileAsync).not.toHaveBeenCalled();
    });

    it("falls back to which ffmpeg", async () => {
      execFileAsync.mockResolvedValue({ stdout: "/usr/bin/ffmpeg\n" });

      await expect(resolveFfmpegPath()).resolves.toBe("/usr/bin/ffmpeg");
      expect(execFileAsync).toHaveBeenCalledWith("which", ["ffmpeg"]);
    });

    it("throws a clear error when ffmpeg is missing", async () => {
      execFileAsync.mockRejectedValue(new Error("not found"));

      await expect(resolveFfmpegPath()).rejects.toThrow(FFMPEG_MISSING_MESSAGE);
    });
  });

  describe("convertOpusRecording", () => {
    it("invokes injectable runner with ffmpeg args and input", async () => {
      const input = Buffer.from("opus-bytes");
      const output = Buffer.from("wav-bytes");
      const run = vi.fn().mockResolvedValue(output);

      const result = await convertOpusRecording(input, "wav", {
        ffmpegPath: "/usr/bin/ffmpeg",
        run,
      });

      expect(result).toEqual(output);
      expect(run).toHaveBeenCalledWith(
        "/usr/bin/ffmpeg",
        buildFfmpegConvertArgs("wav"),
        input,
      );
    });
  });
});
