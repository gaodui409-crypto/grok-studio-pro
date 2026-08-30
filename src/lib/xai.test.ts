import assert from "node:assert/strict";
import test from "node:test";
import {
  POLL_MAX_CONSECUTIVE_ERRORS,
  chatCompletion,
  editVideo,
  extendVideo,
  generateVideo,
  pollVideo,
} from "./xai.ts";

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

/**
 * Same environment stubbing as above, but with a scripted fetch so a poll can be
 * driven through a chosen sequence of failures and successes.
 */
async function withScriptedFetch<T>(
  responses: (() => Promise<Response>)[],
  run: (calls: () => number) => Promise<T>,
): Promise<T> {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalFetch = globalThis.fetch;
  let calls = 0;

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        return JSON.stringify({ provider: "xai", apiKey: "xai-real-key" });
      },
    },
  });
  globalThis.fetch = (() => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    return next();
  }) as typeof fetch;

  try {
    return await run(() => calls);
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

const jsonResponse = (body: unknown) => () =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
const networkFailure = () => Promise.reject(new Error("socket hang up"));

// The video is already rendering on xAI's side and already billing by the time the
// first status GET goes out, so treating one 502 as a failed job threw away
// tracking of something the user had paid for — over a request that costs nothing
// to repeat.
test("a transient status failure does not abandon a paid render", async () => {
  await withScriptedFetch(
    [networkFailure, networkFailure, jsonResponse({ status: "done", video: { url: "u" } })],
    async (calls) => {
      const { promise } = pollVideo("req_1", () => {}, 1);
      const final = await promise;
      assert.equal(final.status, "done");
      assert.equal(calls(), 3, "must have retried past both failures");
    },
  );
});

test("consecutive failures past the cap report the last error", async () => {
  await withScriptedFetch([networkFailure], async (calls) => {
    const { promise } = pollVideo("req_2", () => {}, 1);
    await assert.rejects(promise, /socket hang up/);
    assert.equal(calls(), POLL_MAX_CONSECUTIVE_ERRORS, "must stop at the cap, not retry forever");
  });
});

// Otherwise a long render that blips once every few minutes would eventually
// exhaust the budget even though it never failed twice in a row.
test("the failure count resets after any successful poll", async () => {
  const script = [
    networkFailure,
    networkFailure,
    jsonResponse({ status: "pending" }),
    networkFailure,
    networkFailure,
    jsonResponse({ status: "done", video: { url: "u" } }),
  ];
  await withScriptedFetch(script, async (calls) => {
    const { promise } = pollVideo("req_3", () => {}, 1);
    assert.equal((await promise).status, "done");
    assert.equal(calls(), 6);
  });
});

test("stop() ends the poll without resolving", async () => {
  await withScriptedFetch([jsonResponse({ status: "pending" })], async (calls) => {
    const { stop, promise } = pollVideo("req_4", () => {}, 5);
    let settled = false;
    void promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    // One tick has to land before stopping, or nothing has been polled at all.
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    const afterStop = calls();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls(), afterStop, "no further requests after stop()");
    assert.equal(settled, false, "a stopped poll neither resolves nor rejects");
  });
});
