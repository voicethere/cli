import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@node-webrtc-rust/voice-catalog": path.resolve(
        __dirname,
        "node_modules/@node-webrtc-rust/voice-catalog/dist/cjs/src/index.js",
      ),
    },
  },
});
