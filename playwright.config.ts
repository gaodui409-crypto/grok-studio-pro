import { defineConfig, devices } from "@playwright/test";

// Screenshots are written to e2e/__screens__ for human review, NOT compared as
// baselines. The whole point of this suite is to support a UI refactor, and
// toHaveScreenshot() would fail on every intentional visual change — that turns
// the safety net into noise. Assertions here check behaviour; the images are for
// looking at.
//
// `vite dev` defaults to 8080 and silently walks to 8081+ when that is taken, so
// tests cannot assume a URL. Pin an unusual port with --strictPort: better to
// fail loudly than to run the suite against whatever happens to be on 8081.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Compiles every route once before the suite; see e2e/global-setup.ts for why.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/__report__" }]],
  outputDir: "e2e/__artifacts__",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "off",
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
