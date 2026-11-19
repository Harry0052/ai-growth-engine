import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    include: ["tests/unit/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
