import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60_000,
  projects: [
    { name: "phone-small", use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "phone-large", use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
    { name: "wide-preview", use: { viewport: { width: 1280, height: 800 } } },
  ],
  use: {
    baseURL: process.env.GIVEHUB_E2E_WEB_URL ?? "http://localhost:8081",
    browserName: "chromium",
    launchOptions: { executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
