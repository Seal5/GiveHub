import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.GIVEHUB_E2E_WEB_URL ?? "http://localhost:8081",
    browserName: "chromium",
    launchOptions: { executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
