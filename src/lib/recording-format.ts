import { extname } from "node:path";

export type RecordingOutputFormat = "opus" | "wav" | "mp3";

const FORMAT_BY_EXTENSION: Record<string, RecordingOutputFormat> = {
  ".wav": "wav",
  ".mp3": "mp3",
  ".opus": "opus",
  ".ogg": "opus",
};

const EXTENSION_BY_FORMAT: Record<RecordingOutputFormat, string> = {
  wav: ".wav",
  mp3: ".mp3",
  opus: ".opus",
};

export function parseRecordingOutputFormat(
  value: string,
): RecordingOutputFormat {
  const normalized = value.trim().toLowerCase();
  if (normalized === "opus" || normalized === "wav" || normalized === "mp3") {
    return normalized;
  }
  throw new Error(
    `Invalid --format "${value}" (expected opus, wav, or mp3)`,
  );
}

export function inferFormatFromOutputPath(
  outputPath: string,
): RecordingOutputFormat | undefined {
  const ext = extname(outputPath).toLowerCase();
  return FORMAT_BY_EXTENSION[ext];
}

export function resolveRecordingOutputFormat(options: {
  formatFlag?: string;
  outputPath: string;
}): RecordingOutputFormat {
  if (options.formatFlag !== undefined && options.formatFlag.trim() !== "") {
    return parseRecordingOutputFormat(options.formatFlag);
  }
  return inferFormatFromOutputPath(options.outputPath) ?? "wav";
}

export function resolveRecordingOutputPath(
  outputPath: string,
  format: RecordingOutputFormat,
): string {
  const ext = extname(outputPath).toLowerCase();
  if (!ext) {
    return outputPath + EXTENSION_BY_FORMAT[format];
  }

  const extFormat = FORMAT_BY_EXTENSION[ext];
  if (!extFormat) {
    throw new Error(
      `Output path extension "${ext}" is not recognized for session recordings (use .wav, .mp3, .opus, or .ogg, or omit the extension)`,
    );
  }
  if (extFormat !== format) {
    throw new Error(
      `Output path extension "${ext}" does not match format ${format}`,
    );
  }
  return outputPath;
}

export function extensionForRecordingFormat(
  format: RecordingOutputFormat,
): string {
  return EXTENSION_BY_FORMAT[format];
}
