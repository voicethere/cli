import path from "node:path";
import { defineConfig } from "vitest/config";
import { localWorkerLimit } from "./vitest.workers";

export default defineConfig(async () => ({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "vitest.workers.test.ts"],
    testTimeout: 15_000,
    // Caps local vitest workers across concurrent runs on one machine; no effect in CI.
    ...(await localWorkerLimit()),
  },
  resolve: {
    alias: {
      "@node-webrtc-rust/voice-catalog": path.resolve(
        __dirname,
        "node_modules/@node-webrtc-rust/voice-catalog/dist/cjs/src/index.js",
      ),
    },
  },
}));
