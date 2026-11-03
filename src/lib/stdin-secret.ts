export interface StdinLike extends AsyncIterable<Buffer | string> {
  isTTY?: boolean;
}

export interface ReadSecretFromStdinOptions {
  /** Message thrown when stdin is a terminal. */
  ttyMessage: string;
  /** Message thrown when stdin holds no value. */
  emptyMessage: string;
}

/** Read one secret from piped stdin; strips a single trailing newline. */
export async function readSecretFromStdin(
  stdin: StdinLike,
  options: ReadSecretFromStdinOptions,
): Promise<string> {
  if (stdin.isTTY) {
    throw new Error(options.ttyMessage);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const value = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
  if (!value) {
    throw new Error(options.emptyMessage);
  }
  return value;
}
