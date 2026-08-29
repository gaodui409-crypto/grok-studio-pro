import { test as base, expect, type Page } from "@playwright/test";

export const SETTINGS_KEY = "grok-studio-settings";

// Pages read settings synchronously on first render, so seeding has to happen
// before any app script runs — addInitScript, not an evaluate() after goto().
export async function seedSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [SETTINGS_KEY, JSON.stringify(settings)],
  );
}

// A provider set that makes several channels "ready" without any real network
// access. Keys are obvious fakes: every test that uses this must stop short of
// pressing a generate button.
export const CONFIGURED = {
  provider: "gitee",
  apiKey: "e2e-fake-xai-key",
  giteeApiKey: "e2e-fake-gitee-key",
  pollinationsApiKey: "e2e-fake-pollinations-key",
  modelscopeToken: "e2e-fake-modelscope-token",
  defaultResolution: "1k",
  defaultAspectRatio: "1:1",
  concurrency: 3,
};

export type ConsoleTrap = { errors: string[] };

// React key warnings, hydration mismatches and thrown effects all surface here.
// Vite's dev server also logs benign HMR/websocket noise, which is filtered out
// so a real error stays visible.
const IGNORED = [/\[vite\]/i, /websocket/i, /favicon/i, /Download the React DevTools/i, /lovable/i];

export function trapConsole(page: Page): ConsoleTrap {
  const trap: ConsoleTrap = { errors: [] };
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    trap.errors.push(`[${msg.type()}] ${text}`);
  });
  page.on("pageerror", (err) => trap.errors.push(`[pageerror] ${err.message}`));
  return trap;
}

export const test = base;
export { expect };
