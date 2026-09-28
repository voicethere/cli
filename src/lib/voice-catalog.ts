/**
 * Load `@node-webrtc-rust/voice-catalog` through `require()`.
 *
 * The package ESM build imports `*.json` without `with { type: "json" }`.
 * Node 22+ then throws `ERR_IMPORT_ATTRIBUTE_MISSING` on `import`, which
 * breaks every CLI command (cli.ts eagerly imports voice set). CJS require
 * still works. Vitest aliases the same CJS entry.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const { customerSttProviderIds, customerTtsProviderIds } =
  require("@node-webrtc-rust/voice-catalog") as typeof import("@node-webrtc-rust/voice-catalog");
