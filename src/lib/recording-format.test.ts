import { describe, expect, it } from "vitest";
import {
  inferFormatFromOutputPath,
  parseRecordingOutputFormat,
  resolveRecordingOutputFormat,
  resolveRecordingOutputPath,
} from "./recording-format.js";

describe("recording-format", () => {
  describe("parseRecordingOutputFormat", () => {
    it("accepts opus, wav, and mp3", () => {
      expect(parseRecordingOutputFormat("opus")).toBe("opus");
      expect(parseRecordingOutputFormat("WAV")).toBe("wav");
      expect(parseRecordingOutputFormat(" mp3 ")).toBe("mp3");
    });

    it("rejects unknown formats", () => {
      expect(() => parseRecordingOutputFormat("flac")).toThrow(
        /Invalid --format/,
      );
    });
  });

  describe("inferFormatFromOutputPath", () => {
    it("maps known extensions", () => {
      expect(inferFormatFromOutputPath("./out.wav")).toBe("wav");
      expect(inferFormatFromOutputPath("./out.mp3")).toBe("mp3");
      expect(inferFormatFromOutputPath("./out.opus")).toBe("opus");
      expect(inferFormatFromOutputPath("./out.ogg")).toBe("opus");
    });

    it("returns undefined for missing or unknown extensions", () => {
      expect(inferFormatFromOutputPath("./recording")).toBeUndefined();
      expect(inferFormatFromOutputPath("./recording.bin")).toBeUndefined();
    });
  });

  describe("resolveRecordingOutputFormat", () => {
    it("prefers --format over extension", () => {
      expect(
        resolveRecordingOutputFormat({
          formatFlag: "mp3",
          outputPath: "./out.wav",
        }),
      ).toBe("mp3");
    });

    it("infers from extension when --format is omitted", () => {
      expect(
        resolveRecordingOutputFormat({
          outputPath: "./out.opus",
        }),
      ).toBe("opus");
    });

    it("defaults to wav when extension is missing or unknown", () => {
      expect(
        resolveRecordingOutputFormat({
          outputPath: "./recording",
        }),
      ).toBe("wav");
      expect(
        resolveRecordingOutputFormat({
          outputPath: "./recording.bin",
        }),
      ).toBe("wav");
    });
  });

  describe("resolveRecordingOutputPath", () => {
    it("appends extension when path has none", () => {
      expect(resolveRecordingOutputPath("./recording", "wav")).toBe(
        "./recording.wav",
      );
      expect(resolveRecordingOutputPath("./recording", "mp3")).toBe(
        "./recording.mp3",
      );
      expect(resolveRecordingOutputPath("./recording", "opus")).toBe(
        "./recording.opus",
      );
    });

    it("keeps path when extension matches format", () => {
      expect(resolveRecordingOutputPath("./out.wav", "wav")).toBe("./out.wav");
      expect(resolveRecordingOutputPath("./out.ogg", "opus")).toBe("./out.ogg");
    });

    it("errors when extension conflicts with format", () => {
      expect(() =>
        resolveRecordingOutputPath("./session.opus", "wav"),
      ).toThrow(/does not match format wav/);
      expect(() =>
        resolveRecordingOutputPath("./session.wav", "mp3"),
      ).toThrow(/does not match format mp3/);
    });

    it("errors on unrecognized extensions", () => {
      expect(() =>
        resolveRecordingOutputPath("./session.bin", "wav"),
      ).toThrow(/not recognized/);
    });
  });
});
