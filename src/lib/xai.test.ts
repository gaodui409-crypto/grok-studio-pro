import assert from "node:assert/strict";
import test from "node:test";
import { chatCompletion, editVideo, extendVideo, generateVideo } from "./xai.ts";

// The regression these cover: a user configures xAI, switches the provider to a
// text-to-image-only channel, and the stale apiKey stays in localStorage. Before
// the shared guard, editVideo / extendVideo / chatCompletion skipped the provider
// check and fired real requests at api.x.ai with that stale key.
// Must await run() inside the try: these entry points read localStorage lazily on
// each call, so restoring it while the callback is still pending would let later
// assertions see the real environment instead of the stub.
async function withStoredSettings<T>(
  stored: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalFetch = globalThis.fetch;

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        return JSON.stringify(stored);
      },
    },
  });
  globalThis.fetch = (() => {
    throw new Error("网络请求不应发出");
  }) as typeof fetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
}

const STALE_XAI_KEY = { provider: "modelscope", apiKey: "xai-stale-key", modelscopeToken: "ms-1" };

test("blocks every xAI-only entry point when another provider is selected", async () => {
  await withStoredSettings(STALE_XAI_KEY, async () => {
    await assert.rejects(
      generateVideo({ prompt: "test" }),
      /不支持视频/,
      "generateVideo must refuse a non-xAI provider",
    );
    await assert.rejects(
      editVideo({ prompt: "test", video: "https://example.test/a.mp4" }),
      /不支持视频编辑/,
      "editVideo must refuse a non-xAI provider",
    );
    await assert.rejects(
      extendVideo({ prompt: "test", video: "https://example.test/a.mp4" }),
      /不支持视频延长/,
      "extendVideo must refuse a non-xAI provider",
    );
    await assert.rejects(
      chatCompletion({ messages: [{ role: "user", content: "test" }] }),
      /不支持文字识别翻译/,
      "chatCompletion must refuse a non-xAI provider",
    );
  });
});

test("names the active provider so the message points at the real cause", async () => {
  await withStoredSettings(STALE_XAI_KEY, async () => {
    await assert.rejects(
      editVideo({ prompt: "test", video: "https://example.test/a.mp4" }),
      (error: unknown) => {
        const message = (error as Error).message;
        assert.match(message, /魔搭 ModelScope/, "must name the selected provider");
        assert.doesNotMatch(message, /配置 API Key/, "must not blame a missing xAI key");
        return true;
      },
    );
  });
});

test("lets the xAI provider through the guard to the transport", async () => {
  await withStoredSettings({ provider: "xai", apiKey: "xai-real-key" }, async () => {
    // Reaching the stubbed fetch proves the guard passed rather than short-circuited.
    await assert.rejects(
      editVideo({ prompt: "test", video: "https://example.test/a.mp4" }),
      /网络请求不应发出/,
    );
  });
});
