import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/support/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
