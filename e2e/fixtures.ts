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

export type SeedItem = {
  id: string;
  prompt: string;
  sceneName?: string;
  character?: string;
  provider?: string;
  type?: "image" | "video";
  ageDays?: number;
  size?: number;
  /**
   * Which stand-in bitmap to store.
   *
   * Default is a 1×1 pixel, which is enough for anything that only counts cards.
   * It cannot show a cropping bug though: at 1×1 every fit mode looks identical,
   * so the card could have been cutting a third off every portrait cover and the
   * whole suite would still have passed. "portrait" and "landscape" are 3:8 and
   * 8:3 with white bands along the two long edges, so a render that loses an edge
   * is measurably different from one that keeps it.
   */
  shape?: "pixel" | "portrait" | "landscape";
};

/**
 * Writes records straight into the gallery's IndexedDB store.
 *
 * Generating for real would need live API keys, so the archive is faked. Blobs
 * are 1×1 PNGs — enough for object URLs, `<img>` decoding and card layout to be
 * exercised, without shipping fixture images.
 */
export async function seedGallery(page: Page, items: SeedItem[]) {
  await page.addInitScript((seed) => {
    // 1×1, 72×192 and 192×72. See SeedItem.shape for why the non-square ones exist.
    const PNGS = {
      pixel:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      portrait:
        "iVBORw0KGgoAAAANSUhEUgAAAEgAAADACAIAAAAobLKlAAAAxklEQVR42u3PAQ0AMAgEMeRME9rnBWyQTy9noDWhFRgYGBgYGBgYGBgY2HHYfx05GBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGNhJ2IQGBgYGBgYGBgYGBpbSAo8q+2JA4atQAAAAAElFTkSuQmCC",
      landscape:
        "iVBORw0KGgoAAAANSUhEUgAAAMAAAABICAIAAAAvXW3lAAAApElEQVR42u3SQREAMAgDQeQgsWLrhWqgPNnMKshclNlg4QITkAnIBGQCMmsGlOfCNwEhIASEgBAQCAgBISAEBAJCQAgIAYGAEBACQkAgIASEgBAQAgIBISAEhIBAQAgIASEgEBACQkAICASEgBAQAkJAICAEhIAQEAgIASEgBAQCQkAICAGBgBAQAkJAICAEhIAQEAKCdkBlNpiATEAmIBOQbdwDlkmVpQ61qsIAAAAASUVORK5CYII=",
    };
    const toBlob = (base64: string, mime: string) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return new Blob([bytes], { type: mime });
    };

    const seedDone = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("grok-studio-gallery", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("images")) {
          const store = db.createObjectStore("images", { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("sceneName", "sceneName");
          store.createIndex("character", "character");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        for (const item of seed as SeedItem[]) {
          const isVideo = item.type === "video";
          const mimeType = isVideo ? "video/mp4" : "image/png";
          const blob = toBlob(PNGS[item.shape ?? "pixel"], mimeType);
          store.put({
            ...item,
            blob,
            mimeType,
            type: item.type ?? "image",
            size: item.size ?? 1024,
            createdAt: Date.now() - (item.ageDays ?? 0) * 86_400_000,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    // The seed and the app's own first read are not ordered relative to each
    // other, so instead of trying to win the race, announce the write. If the
    // seed commits first the initial listGallery() already sees it; if it
    // commits later this event makes the page re-read. Either order works.
    void seedDone
      .then(() => window.dispatchEvent(new CustomEvent("grok-gallery-changed")))
      .catch((err) => console.warn("[e2e] gallery seed failed", err));
  }, items);
}

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
