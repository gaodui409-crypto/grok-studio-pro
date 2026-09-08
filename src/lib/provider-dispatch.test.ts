import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { defaultSettings } from "./settings.ts";
import {
  generateImages,
  generateImagesForProvider,
  generateImagesWithFallback,
  editImagesForProvider,
} from "./xai.ts";
import { imageProviderRegistry } from "./providers/index.ts";
import { usedToday } from "./quota.ts";
import { PartialBatchError } from "./partial-batch.ts";
import { setImmediate } from "node:timers/promises";

function browser(t: TestContext) {
  const values = new Map<string, string>();
  const originals = ["window", "localStorage"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return (settings: unknown) => values.set("grok-studio-settings", JSON.stringify(settings));
}

test("explicit generation and editing keep the batch model, endpoint and credentials", async (t) => {
  const save = browser(t);
  const snapshot = {
    ...defaultSettings,
    apiKey: "old-key",
    baseUrl: "https://old.invalid",
    imageModel: "old-model",
  };
  save({ ...snapshot, apiKey: "new-key", baseUrl: "https://new.invalid", imageModel: "new-model" });
  const models: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.startsWith(snapshot.baseUrl));
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer old-key");
    models.push(JSON.parse(String(init.body)).model);
    return Response.json({ data: [{ b64_json: "fixture" }] });
  });
  await generateImagesForProvider("xai", { prompt: "fixture", model: "old-model" }, snapshot);
  await editImagesForProvider(
    "xai",
    { prompt: "fixture", model: "old-model", images: ["data:image/png;base64,fixture"] },
    snapshot,
  );
  assert.deepEqual(models, ["old-model", "old-model"]);
});

test("explicit generation records successful and partial batches exactly once", async (t) => {
  const save = browser(t);
  save({ ...defaultSettings, provider: "gitee", giteeApiKey: "fixture" });
  const adapter = imageProviderRegistry.get("gitee");
  t.mock.method(adapter, "generateImages", async () => [{ url: "data:image/png;base64,fixture" }]);
  await generateImagesForProvider("gitee", { prompt: "fixture" });
  assert.equal(usedToday("gitee"), 1);
  t.mock.method(adapter, "generateImages", async () => {
    throw new PartialBatchError(
      [{ url: "data:image/png;base64,fixture" }],
      1,
      new Error("limited"),
    );
  });
  const outcome = await generateImagesWithFallback({ prompt: "fixture", n: 2 });
  assert.equal(outcome.images.length, 1);
  assert.equal(outcome.partialError, "limited");
  assert.equal(usedToday("gitee"), 2);
});

test("regular generation still resolves stale page models from saved settings", async (t) => {
  const save = browser(t);
  save({ ...defaultSettings, provider: "xai", apiKey: "fixture", imageModel: "saved-model" });
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(String(init.body)).model, "saved-model");
    return Response.json({ data: [{ b64_json: "fixture" }] });
  });
  await generateImages({ prompt: "fixture", model: "stale-model" });
  assert.equal(usedToday("xai"), 1);
});

test("generation and editing share the account concurrency limit across batches", async (t) => {
  browser(t);
  const settings = { ...defaultSettings, apiKey: "shared-fixture", concurrency: 1 };
  const adapter = imageProviderRegistry.requireImageEditing("xai");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  t.mock.method(adapter, "generateImages", async () => {
    calls.push("generate");
    await pending;
    return [];
  });
  t.mock.method(adapter, "editImages", async () => {
    calls.push("edit");
    return [];
  });
  const generation = generateImagesForProvider("xai", { prompt: "fixture" }, settings);
  const editing = editImagesForProvider("xai", { prompt: "fixture", images: [] }, settings);
  try {
    await setImmediate();
    assert.deepEqual(calls, ["generate"]);
  } finally {
    release();
    await Promise.all([generation, editing]);
  }
  assert.deepEqual(calls, ["generate", "edit"]);
});

test("a cancelled queued generation never reaches the adapter", async (t) => {
  browser(t);
  const settings = { ...defaultSettings, apiKey: "cancel-fixture", concurrency: 1 };
  const adapter = imageProviderRegistry.get("xai");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  t.mock.method(adapter, "generateImages", async () => {
    calls++;
    await pending;
    return [];
  });
  const first = generateImagesForProvider("xai", { prompt: "first" }, settings);
  const controller = new AbortController();
  const second = generateImagesForProvider(
    "xai",
    { prompt: "second", signal: controller.signal },
    settings,
  );
  const cancelled = assert.rejects(second, { name: "AbortError" });
  controller.abort();
  release();
  await Promise.all([first, cancelled]);
  assert.equal(calls, 1);
});

test("different credentials can run independently without increasing an active batch limit", async (t) => {
  browser(t);
  const settings = { ...defaultSettings, apiKey: "account-a", concurrency: 1 };
  const adapter = imageProviderRegistry.get("xai");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  t.mock.method(adapter, "generateImages", async (params: { prompt: string }) => {
    calls.push(params.prompt);
    if (params.prompt === "first") await pending;
    return [];
  });
  const first = generateImagesForProvider("xai", { prompt: "first" }, settings);
  const second = generateImagesForProvider(
    "xai",
    { prompt: "second" },
    { ...settings, concurrency: 3 },
  );
  const other = generateImagesForProvider(
    "xai",
    { prompt: "other" },
    { ...settings, apiKey: "account-b" },
  );
  try {
    await setImmediate();
    assert.deepEqual(calls, ["first", "other"]);
  } finally {
    release();
    await Promise.all([first, second, other]);
  }
  assert.deepEqual(calls, ["first", "other", "second"]);
});

test("the shared queue honours concurrency above one and releases slots after failures", async (t) => {
  browser(t);
  const settings = { ...defaultSettings, apiKey: "two-slots-fixture", concurrency: 2 };
  const adapter = imageProviderRegistry.get("xai");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  t.mock.method(adapter, "generateImages", async (params: { prompt: string }) => {
    calls.push(params.prompt);
    if (params.prompt !== "third") await pending;
    if (params.prompt === "first") throw new Error("fixture failure");
    return [];
  });
  const first = assert.rejects(
    generateImagesForProvider("xai", { prompt: "first" }, settings),
    /fixture failure/,
  );
  const second = generateImagesForProvider("xai", { prompt: "second" }, settings);
  const third = generateImagesForProvider("xai", { prompt: "third" }, settings);
  try {
    await setImmediate();
    assert.deepEqual(calls, ["first", "second"]);
  } finally {
    release();
    await Promise.all([first, second, third]);
  }
  assert.deepEqual(calls, ["first", "second", "third"]);
});
