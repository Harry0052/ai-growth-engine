import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3847" },
  webServer: {
    command: "rm -f data/e2e.sqlite data/e2e.sqlite-wal data/e2e.sqlite-shm && npm run db:setup && npm run dev",
    url: "http://127.0.0.1:3847/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_EMAIL: "harry@localhost",
      ADMIN_PASSWORD: "growth-engine-local",
      AUTH_SECRET: "e2e-auth-secret",
      SQLITE_PATH: "data/e2e.sqlite",
      PORT: "3847",
    },
  },
});
