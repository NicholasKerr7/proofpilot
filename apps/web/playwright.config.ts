import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");
const baseURL = process.env.PROOFPILOT_E2E_WEB_URL ?? "http://localhost:3000";
const apiHealthURL =
  process.env.PROOFPILOT_E2E_API_URL ?? "http://localhost:4000/health";

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results",
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { height: 844, width: 390 }
      }
    },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome HiDPI"],
        hasTouch: true,
        viewport: { height: 1024, width: 768 }
      }
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1280 }
      }
    }
  ],
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never", outputFolder: "playwright-report" }]
      ]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  timeout: 45_000,
  use: {
    baseURL,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: process.env.CI
    ? [
        {
          command: "exec node apps/api/dist/main.js",
          cwd: repoRoot,
          reuseExistingServer: false,
          timeout: 120_000,
          url: apiHealthURL
        },
        {
          command: "exec node node_modules/next/dist/bin/next dev -p 3000",
          cwd: __dirname,
          reuseExistingServer: false,
          timeout: 120_000,
          url: baseURL
        }
      ]
    : undefined,
  workers: 1
});
