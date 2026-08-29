# Provider Reliability Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the seven confirmed provider, settings, polling, media, gallery, and persistence defects while preserving xAI compatibility and adding no new channels.

**Architecture:** Extract small dependency-free TypeScript helpers for provider resolution, settings mapping, HTTP/media handling, ModelScope polling, object URL ownership, and persistence outcomes. Keep provider credentials and payload translation in `xai.ts`, apply saved defaults through one Zustand action, and keep route changes limited to cancellation and user feedback.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, TanStack Start, Node 22 built-in test runner, IndexedDB, Fetch API.

---

## File Map

**Create:**

- `src/lib/provider-runtime.ts`: provider-specific model resolution and fixed provider constants.
- `src/lib/provider-runtime.test.ts`: provider model regression tests.
- `src/lib/settings-defaults.ts`: pure mapping from saved settings to page-state patches.
- `src/lib/settings-defaults.test.ts`: default propagation regression tests.
- `src/lib/http.ts`: one-read error parsing, checked media fetch, and abort detection.
- `src/lib/http.test.ts`: response and media-fetch regression tests.
- `src/lib/modelscope-polling.ts`: bounded, abortable ModelScope task polling.
- `src/lib/modelscope-polling.test.ts`: success, terminal failure, timeout, and abort tests.
- `src/lib/object-url-registry.ts`: deterministic object URL ownership.
- `src/lib/object-url-registry.test.ts`: reuse, reconciliation, and disposal tests.
- `src/lib/persistence.ts`: non-throwing persistence outcome helper.
- `src/lib/persistence.test.ts`: success/failure outcome tests.

**Modify:**

- `package.json`: add the dependency-free TypeScript test command.
- `src/lib/xai.ts`: consume provider, HTTP, and polling helpers; pass abort signals.
- `src/lib/app-store.ts`: add the centralized settings-default action.
- `src/routes/__root.tsx`: apply defaults once after client startup.
- `src/routes/settings.tsx`: apply defaults after explicit Save.
- `src/routes/index.tsx`: create/cancel a generation AbortController.
- `src/routes/fanart.tsx`: create/cancel a batch AbortController.
- `src/lib/gallery-db.ts`: reject failed media responses before IndexedDB writes.
- `src/lib/download.ts`: use checked media responses and return ZIP failure counts.
- `src/components/image-gallery.tsx`: report incomplete ZIP downloads.
- `src/routes/gallery.tsx`: replace stale URL state ownership with the registry.
- `src/routes/comic.tsx`: await persistence outcomes and report unsaved/skipped counts.

## Task 1: Test Harness and Provider Model Resolution

**Files:**

- Modify: `package.json:7-14`
- Create: `src/lib/provider-runtime.ts`
- Create: `src/lib/provider-runtime.test.ts`
- Modify: `src/lib/xai.ts:94-110,138-220`

- [ ] **Step 1: Add the Node TypeScript test script**

Add this script to `package.json` before `dev`:

```json
"test": "node --experimental-strip-types --test \"src/**/*.test.ts\""
```

- [ ] **Step 2: Write the failing provider-resolution tests**

Create `src/lib/provider-runtime.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { MODELSCOPE_IMAGE_MODEL, resolveImageModel } from "./provider-runtime.ts";

const models = {
  xai: "grok-imagine-image-pro",
  hf: "Tongyi-MAI/Z-Image-Turbo",
};

test("xAI uses the page model when one is selected", () => {
  assert.equal(resolveImageModel("xai", "grok-imagine-image", models), "grok-imagine-image");
});

test("xAI falls back to its saved model", () => {
  assert.equal(resolveImageModel("xai", undefined, models), models.xai);
});

test("Hugging Face ignores an xAI page model", () => {
  assert.equal(resolveImageModel("hf", "grok-imagine-image-pro", models), models.hf);
});

test("ModelScope always uses its supported model", () => {
  assert.equal(
    resolveImageModel("modelscope", "grok-imagine-image-pro", models),
    MODELSCOPE_IMAGE_MODEL,
  );
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/provider-runtime.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `provider-runtime.ts`.

- [ ] **Step 4: Implement the minimal provider resolver**

Create `src/lib/provider-runtime.ts`:

```ts
import type { ProviderId } from "./settings.ts";

export const MODELSCOPE_IMAGE_MODEL = "Tongyi-MAI/Z-Image-Turbo";

export type ProviderModels = {
  xai: string;
  hf: string;
};

export function resolveImageModel(
  provider: ProviderId,
  requestedModel: string | undefined,
  models: ProviderModels,
): string {
  if (provider === "hf") return models.hf;
  if (provider === "modelscope") return MODELSCOPE_IMAGE_MODEL;
  return requestedModel || models.xai;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/provider-runtime.test.ts
```

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 6: Route current provider implementations through the resolver**

In `src/lib/xai.ts`, import:

```ts
import { MODELSCOPE_IMAGE_MODEL, resolveImageModel } from "./provider-runtime.ts";
```

Use the resolver in all image branches:

```ts
const model = resolveImageModel(cfg.provider, p.model, {
  xai: cfg.imageModel,
  hf: cfg.hfModel || "Tongyi-MAI/Z-Image-Turbo",
});
```

Set the xAI request body's `model` to `model`, set the ModelScope payload's `model` to `MODELSCOPE_IMAGE_MODEL`, and replace the current HF `p.model || cfg.hfModel` expression with the resolved `model`.

- [ ] **Step 7: Re-run provider tests**

Run:

```powershell
npm.cmd test -- --test-name-pattern="model|xAI|Hugging Face|ModelScope"
```

Expected: PASS, provider tests have 0 failures.

- [ ] **Step 8: Commit the provider-resolution repair**

```powershell
git add package.json src/lib/provider-runtime.ts src/lib/provider-runtime.test.ts src/lib/xai.ts
git commit -m "fix: isolate provider image model selection"
```

## Task 2: Saved Settings Default Propagation

**Files:**

- Create: `src/lib/settings-defaults.ts`
- Create: `src/lib/settings-defaults.test.ts`
- Modify: `src/lib/app-store.ts:9-12,113-126,200-213`
- Modify: `src/routes/__root.tsx:1-5,77-98`
- Modify: `src/routes/settings.tsx:12-14,30-40`

- [ ] **Step 1: Write failing settings-mapping tests**

Create `src/lib/settings-defaults.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "./settings.ts";
import { getSettingsDefaultPatches } from "./settings-defaults.ts";

test("maps image defaults only to image workflows", () => {
  const settings = {
    ...defaultSettings,
    imageModel: "custom-image",
    videoModel: "custom-video",
    defaultAspectRatio: "16:9",
    defaultResolution: "2k" as const,
  };

  assert.deepEqual(getSettingsDefaultPatches(settings), {
    t2i: { aspect: "16:9", resolution: "2k", model: "custom-image" },
    i2i: { resolution: "2k", model: "custom-image" },
    video: { model: "custom-video" },
    fanart: { aspect: "16:9", resolution: "2k", model: "custom-image" },
    comic: { model: "custom-image" },
  });
});

test("does not map image resolution into video resolution", () => {
  const patches = getSettingsDefaultPatches({ ...defaultSettings, defaultResolution: "2k" });
  assert.deepEqual(Object.keys(patches.video), ["model"]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/settings-defaults.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `settings-defaults.ts`.

- [ ] **Step 3: Implement the pure settings mapper**

Create `src/lib/settings-defaults.ts`:

```ts
import type { Settings } from "./settings.ts";

export function getSettingsDefaultPatches(settings: Settings) {
  return {
    t2i: {
      aspect: settings.defaultAspectRatio,
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    i2i: {
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    video: {
      model: settings.videoModel,
    },
    fanart: {
      aspect: settings.defaultAspectRatio,
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    comic: {
      model: settings.imageModel,
    },
  } as const;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/settings-defaults.test.ts
```

Expected: PASS, 2 tests, 0 failures.

- [ ] **Step 5: Add one centralized store action**

In `src/lib/app-store.ts`, import `Settings` and `getSettingsDefaultPatches`, add this interface member, and add this action:

```ts
applySettingsDefaults: (settings: Settings) => void;
```

```ts
applySettingsDefaults: (settings) => set((state) => {
  const patches = getSettingsDefaultPatches(settings);
  return {
    t2i: { ...state.t2i, ...patches.t2i },
    i2i: { ...state.i2i, ...patches.i2i },
    video: { ...state.video, ...patches.video },
    fanart: { ...state.fanart, ...patches.fanart },
    comic: { ...state.comic, ...patches.comic },
  };
}),
```

Use type-only import `import type { Settings } from "./settings";` and runtime import `import { getSettingsDefaultPatches } from "./settings-defaults";` to match existing application import style.

- [ ] **Step 6: Apply defaults at client startup**

In `src/routes/__root.tsx`, add `useEffect`, `loadSettings`, and `useAppStore` imports. At the start of `RootComponent`, add:

```ts
const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);

useEffect(() => {
  applySettingsDefaults(loadSettings());
}, [applySettingsDefaults]);
```

- [ ] **Step 7: Apply defaults after explicit settings Save**

In `src/routes/settings.tsx`, select the store action:

```ts
const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);
```

Change `save` to:

```ts
const save = () => {
  update(draft);
  applySettingsDefaults(draft);
  toast.success("设置已保存并应用");
};
```

- [ ] **Step 8: Run all dependency-free tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 6 tests, 0 failures.

- [ ] **Step 9: Commit settings propagation**

```powershell
git add src/lib/settings-defaults.ts src/lib/settings-defaults.test.ts src/lib/app-store.ts src/routes/__root.tsx src/routes/settings.tsx
git commit -m "fix: apply saved generation defaults"
```

## Task 3: One-Read Provider Errors and Checked Media Fetching

**Files:**

- Create: `src/lib/http.ts`
- Create: `src/lib/http.test.ts`
- Modify: `src/lib/xai.ts:70-91,150-176,192-216`
- Modify: `src/lib/gallery-db.ts:54-60`
- Modify: `src/lib/download.ts:1-39`
- Modify: `src/components/image-gallery.tsx:1-37`

- [ ] **Step 1: Write failing HTTP and blob tests**

Create `src/lib/http.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { fetchBlobChecked, responseErrorMessage } from "./http.ts";

test("preserves a plain-text provider error", async () => {
  const response = new Response("plain provider error", { status: 500 });
  assert.equal(await responseErrorMessage(response), "plain provider error");
  assert.equal(response.bodyUsed, true);
});

test("extracts a nested JSON provider error", async () => {
  const response = new Response(JSON.stringify({ error: { message: "bad key" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  assert.equal(await responseErrorMessage(response), "bad key");
});

test("falls back to HTTP status for an empty body", async () => {
  assert.equal(await responseErrorMessage(new Response(null, { status: 503 })), "HTTP 503");
});

test("checked blob fetch rejects non-2xx responses", async () => {
  await assert.rejects(
    fetchBlobChecked(
      "https://example.test/image.png",
      async () => new Response("missing", { status: 404 }),
    ),
    /missing/,
  );
});

test("checked blob fetch returns a successful blob", async () => {
  const blob = await fetchBlobChecked(
    "https://example.test/image.png",
    async () => new Response("image", { status: 200, headers: { "content-type": "image/png" } }),
  );
  assert.equal(blob.type, "image/png");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/http.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `http.ts`.

- [ ] **Step 3: Implement one-read errors and checked blobs**

Create `src/lib/http.ts`:

```ts
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function messageFromParsedJson(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { error?: unknown; message?: unknown };
  if (data.error && typeof data.error === "object") {
    const nested = data.error as { message?: unknown };
    if (typeof nested.message === "string" && nested.message) return nested.message;
  }
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.message === "string" && data.message) return data.message;
  return null;
}

export async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    return messageFromParsedJson(JSON.parse(text)) || text;
  } catch {
    return text;
  }
}

export async function assertResponseOk(response: Response, prefix = ""): Promise<Response> {
  if (response.ok) return response;
  const message = await responseErrorMessage(response);
  throw new Error(prefix ? `${prefix}: ${message}` : message);
}

export async function fetchBlobChecked(url: string, fetchImpl: FetchLike = fetch): Promise<Blob> {
  const response = await fetchImpl(url);
  await assertResponseOk(response);
  return response.blob();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/http.test.ts
```

Expected: PASS, 5 tests, 0 failures.

- [ ] **Step 5: Replace provider error parsing**

In `src/lib/xai.ts`, import `assertResponseOk`. Replace each manual `res.ok`/JSON-then-text block with:

```ts
await assertResponseOk(res);
```

Use provider prefixes where the current message names a provider:

```ts
await assertResponseOk(start, "ModelScope");
await assertResponseOk(poll, "ModelScope poll");
await assertResponseOk(res, "HF");
```

- [ ] **Step 6: Use checked blobs in gallery persistence**

In `src/lib/gallery-db.ts`, import `fetchBlobChecked` and replace:

```ts
const res = await fetch(url);
const blob = await res.blob();
```

with:

```ts
const blob = await fetchBlobChecked(url);
```

- [ ] **Step 7: Use checked blobs and return ZIP counts**

In `src/lib/download.ts`, import `fetchBlobChecked`, use it in `downloadOne`, and change ZIP download to return counts:

```ts
export type DownloadBatchResult = { saved: number; failed: number };

export async function downloadAllAsZip(
  items: { url: string; filename: string }[],
  zipName = "grok-studio.zip",
): Promise<DownloadBatchResult> {
  const zip = new JSZip();
  let saved = 0;
  let failed = 0;
  await Promise.all(
    items.map(async (item) => {
      try {
        zip.file(item.filename, await fetchBlobChecked(item.url));
        saved++;
      } catch {
        failed++;
      }
    }),
  );
  saveAs(await zip.generateAsync({ type: "blob" }), zipName);
  return { saved, failed };
}
```

- [ ] **Step 8: Report incomplete image ZIPs**

In `src/components/image-gallery.tsx`, import `toast` and add:

```ts
const downloadZip = async () => {
  const result = await downloadAllAsZip(
    images.map((image, index) => ({ url: image.url, filename: filenameOf(index) })),
    `${prefix}-${Date.now()}.zip`,
  );
  if (result.failed) toast.warning(`已下载 ${result.saved} 张，${result.failed} 张获取失败`);
};
```

Set the ZIP button's `onClick` to `downloadZip`.

- [ ] **Step 9: Run all tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 11 tests, 0 failures.

- [ ] **Step 10: Commit HTTP and media handling**

```powershell
git add src/lib/http.ts src/lib/http.test.ts src/lib/xai.ts src/lib/gallery-db.ts src/lib/download.ts src/components/image-gallery.tsx
git commit -m "fix: reject failed provider and media responses"
```

## Task 4: Bounded and Cancellable ModelScope Polling

**Files:**

- Create: `src/lib/modelscope-polling.ts`
- Create: `src/lib/modelscope-polling.test.ts`
- Modify: `src/lib/xai.ts:11-24,138-181`
- Modify: `src/routes/index.tsx:1-3,26-49,67-72`
- Modify: `src/routes/fanart.tsx:2-7,80-119,233-273,571-578`

- [ ] **Step 1: Write failing polling tests**

Create `src/lib/modelscope-polling.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { pollModelScopeTask } from "./modelscope-polling.ts";

const noDelay = async () => {};

test("returns the first output image after success", async () => {
  const statuses = [
    { task_status: "RUNNING" },
    { task_status: "SUCCEED", output_images: ["https://example.test/result.png"] },
  ];
  const result = await pollModelScopeTask(async () => statuses.shift()!, { sleep: noDelay });
  assert.equal(result, "https://example.test/result.png");
});

test("rejects known terminal failure states", async () => {
  await assert.rejects(
    pollModelScopeTask(async () => ({ task_status: "CANCELLED", errors: "quota" }), {
      sleep: noDelay,
    }),
    /CANCELLED.*quota/,
  );
});

test("times out pending tasks", async () => {
  let now = 0;
  await assert.rejects(
    pollModelScopeTask(async () => ({ task_status: "RUNNING" }), {
      sleep: async () => {
        now += 6;
      },
      now: () => now,
      timeoutMs: 5,
    }),
    /超时/,
  );
});

test("honors an aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    pollModelScopeTask(async () => ({ task_status: "RUNNING" }), {
      signal: controller.signal,
      sleep: noDelay,
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/modelscope-polling.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `modelscope-polling.ts`.

- [ ] **Step 3: Implement bounded polling**

Create `src/lib/modelscope-polling.ts`:

```ts
export type ModelScopeTaskStatus = {
  task_status: string;
  output_images?: string[];
  errors?: unknown;
};

type PollOptions = {
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const FAILED = new Set(["FAILED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);

function abortError(): DOMException {
  return new DOMException("操作已取消", "AbortError");
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", cancelled);
      resolve();
    }
    function cancelled() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelled);
      reject(abortError());
    }
    signal?.addEventListener("abort", cancelled, { once: true });
  });
}

export async function pollModelScopeTask(
  getStatus: () => Promise<ModelScopeTaskStatus>,
  options: PollOptions = {},
): Promise<string> {
  const {
    signal,
    intervalMs = 5000,
    timeoutMs = 10 * 60 * 1000,
    now = Date.now,
    sleep = abortableSleep,
  } = options;
  const startedAt = now();

  while (true) {
    if (signal?.aborted) throw abortError();
    if (now() - startedAt >= timeoutMs) throw new Error("ModelScope 任务轮询超时");
    await sleep(intervalMs, signal);
    const status = await getStatus();
    if (status.task_status === "SUCCEED") {
      const url = status.output_images?.[0];
      if (!url) throw new Error("ModelScope 未返回 output_images");
      return url;
    }
    if (FAILED.has(status.task_status)) {
      throw new Error(`ModelScope 任务 ${status.task_status}: ${JSON.stringify(status.errors)}`);
    }
  }
}
```

- [ ] **Step 4: Run polling tests and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/modelscope-polling.test.ts
```

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 5: Pass abort signals through image APIs**

Add `signal?: AbortSignal` to `ImageGenParams` and `ImageEditParams`. Pass `signal: p.signal` to xAI, ModelScope start/poll, and HF fetch calls. Replace the inline ModelScope `while (true)` with:

```ts
const url = await pollModelScopeTask(
  async () => {
    const poll = await fetch(`${baseUrl}/v1/tasks/${task_id}`, {
      signal: p.signal,
      headers: {
        Authorization: `Bearer ${cfg.modelscopeToken}`,
        "X-ModelScope-Task-Type": "image_generation",
      },
    });
    await assertResponseOk(poll, "ModelScope poll");
    return poll.json() as Promise<ModelScopeTaskStatus>;
  },
  { signal: p.signal },
);
return { url, mime_type: "image/png" };
```

- [ ] **Step 6: Add text-to-image cancellation**

In `src/routes/index.tsx`, import `useRef`, `X`, and `isAbortError`. Add:

```ts
const generationRef = useRef<AbortController | null>(null);

const cancelGenerate = () => generationRef.current?.abort();
```

At the start of `handleGenerate`, create and store a controller; pass `signal` to `generateImages`. In `catch`, show `toast.info("已取消生成")` for aborts and the existing error toast otherwise. In `finally`, clear the matching controller and loading state.

Render a secondary cancel button beside Generate while loading:

```tsx
{
  loading && (
    <Button type="button" variant="secondary" onClick={cancelGenerate}>
      <X className="mr-2 h-4 w-4" /> 取消
    </Button>
  );
}
```

- [ ] **Step 7: Add fanart batch cancellation**

In `src/routes/fanart.tsx`, import `useRef`, `Ban`, and `isAbortError`. Add a controller ref and `cancelRun`. In `handleRun`, create one controller, pass its signal to every `generateImages`/`editImages` call, call `signal.throwIfAborted()` at worker start, rethrow abort errors from the worker, and handle the outer abort with one `toast.info("已取消批量生成")`.

Replace the single run button with:

```tsx
<div className="flex gap-2">
  <Button
    onClick={handleRun}
    disabled={running || !promptItems.length}
    className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
  >
    {running ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Sparkles className="mr-2 h-4 w-4" />
    )}
    {running ? "批量生成中…" : `开始批量生成 · ${promptItems.length} 张`}
  </Button>
  {running && (
    <Button type="button" variant="secondary" onClick={cancelRun}>
      <Ban className="mr-2 h-4 w-4" /> 取消
    </Button>
  )}
</div>
```

- [ ] **Step 8: Run the complete Node suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 15 tests, 0 failures.

- [ ] **Step 9: Commit bounded polling and cancellation**

```powershell
git add src/lib/modelscope-polling.ts src/lib/modelscope-polling.test.ts src/lib/xai.ts src/routes/index.tsx src/routes/fanart.tsx
git commit -m "fix: bound and cancel image generation polling"
```

## Task 5: Deterministic Gallery Object URL Ownership

**Files:**

- Create: `src/lib/object-url-registry.ts`
- Create: `src/lib/object-url-registry.test.ts`
- Modify: `src/routes/gallery.tsx:2,41-83,148-154,365-369`

- [ ] **Step 1: Write failing registry tests**

Create `src/lib/object-url-registry.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { ObjectUrlRegistry } from "./object-url-registry.ts";

test("reuses an existing object URL for the same item", () => {
  let created = 0;
  const registry = new ObjectUrlRegistry(
    () => `blob:${++created}`,
    () => {},
  );
  const blob = new Blob(["a"]);
  assert.equal(registry.register("one", blob), "blob:1");
  assert.equal(registry.register("one", blob), "blob:1");
  assert.equal(created, 1);
});

test("reconcile revokes URLs for removed items", () => {
  const revoked: string[] = [];
  const registry = new ObjectUrlRegistry(
    (blob) => `blob:${blob.size}`,
    (url) => revoked.push(url),
  );
  registry.register("one", new Blob(["a"]));
  registry.register("two", new Blob(["bb"]));
  registry.reconcile(new Set(["two"]));
  assert.deepEqual(revoked, ["blob:1"]);
  assert.deepEqual(registry.snapshot(), { two: "blob:2" });
});

test("dispose revokes every remaining URL", () => {
  const revoked: string[] = [];
  const registry = new ObjectUrlRegistry(
    (blob) => `blob:${blob.size}`,
    (url) => revoked.push(url),
  );
  registry.register("one", new Blob(["a"]));
  registry.register("two", new Blob(["bb"]));
  registry.dispose();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  assert.deepEqual(registry.snapshot(), {});
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/object-url-registry.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `object-url-registry.ts`.

- [ ] **Step 3: Implement the registry**

Create `src/lib/object-url-registry.ts`:

```ts
export class ObjectUrlRegistry {
  private readonly urls = new Map<string, string>();
  private readonly createUrl: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;

  constructor(createUrl: (blob: Blob) => string, revokeUrl: (url: string) => void) {
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
  }

  has(id: string): boolean {
    return this.urls.has(id);
  }

  register(id: string, blob: Blob): string {
    const current = this.urls.get(id);
    if (current) return current;
    const url = this.createUrl(blob);
    this.urls.set(id, url);
    return url;
  }

  remove(id: string): void {
    const url = this.urls.get(id);
    if (!url) return;
    this.revokeUrl(url);
    this.urls.delete(id);
  }

  reconcile(ids: ReadonlySet<string>): void {
    for (const id of this.urls.keys()) {
      if (!ids.has(id)) this.remove(id);
    }
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.urls);
  }

  dispose(): void {
    for (const id of [...this.urls.keys()]) this.remove(id);
  }
}
```

- [ ] **Step 4: Run registry tests and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/object-url-registry.test.ts
```

Expected: PASS, 3 tests, 0 failures.

- [ ] **Step 5: Integrate registry ownership into the gallery route**

In `src/routes/gallery.tsx`, import `useRef` and `ObjectUrlRegistry`. Create the registry once:

```ts
const urlRegistryRef = useRef<ObjectUrlRegistry | null>(null);
if (!urlRegistryRef.current) {
  urlRegistryRef.current = new ObjectUrlRegistry(
    (blob) => URL.createObjectURL(blob),
    (url) => URL.revokeObjectURL(url),
  );
}
const urlRegistry = urlRegistryRef.current;
```

Replace the current items effect with:

```ts
useEffect(() => {
  let cancelled = false;
  const currentIds = new Set(items.map((item) => item.id));
  urlRegistry.reconcile(currentIds);
  setUrlCache(urlRegistry.snapshot());

  (async () => {
    for (const item of items) {
      if (urlRegistry.has(item.id)) continue;
      const full = await getGalleryItem(item.id);
      if (cancelled || !full) continue;
      urlRegistry.register(item.id, full.blob);
      setUrlCache(urlRegistry.snapshot());
    }
  })();

  return () => {
    cancelled = true;
  };
}, [items, urlRegistry]);

useEffect(() => () => urlRegistry.dispose(), [urlRegistry]);
```

The existing delete actions continue to refresh the list; reconciliation performs the actual URL revocation.

- [ ] **Step 6: Run all Node tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 18 tests, 0 failures.

- [ ] **Step 7: Commit object URL ownership**

```powershell
git add src/lib/object-url-registry.ts src/lib/object-url-registry.test.ts src/routes/gallery.tsx
git commit -m "fix: release gallery object URLs"
```

## Task 6: Comic Persistence and Export Feedback

**Files:**

- Create: `src/lib/persistence.ts`
- Create: `src/lib/persistence.test.ts`
- Modify: `src/routes/comic.tsx:187-249,306-385`

- [ ] **Step 1: Write failing persistence outcome tests**

Create `src/lib/persistence.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { attemptPersistence } from "./persistence.ts";

test("reports successful persistence", async () => {
  assert.deepEqual(await attemptPersistence(async () => {}), { saved: true });
});

test("captures persistence failures without throwing", async () => {
  const result = await attemptPersistence(async () => {
    throw new Error("quota exceeded");
  });
  assert.equal(result.saved, false);
  if (!result.saved) assert.equal(result.error.message, "quota exceeded");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --experimental-strip-types --test src/lib/persistence.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `persistence.ts`.

- [ ] **Step 3: Implement persistence outcomes**

Create `src/lib/persistence.ts`:

```ts
export type PersistenceResult = { saved: true } | { saved: false; error: Error };

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function attemptPersistence(save: () => Promise<unknown>): Promise<PersistenceResult> {
  try {
    await save();
    return { saved: true };
  } catch (error) {
    return { saved: false, error: asError(error) };
  }
}
```

- [ ] **Step 4: Run persistence tests and verify GREEN**

Run:

```powershell
node --experimental-strip-types --test src/lib/persistence.test.ts
```

Expected: PASS, 2 tests, 0 failures.

- [ ] **Step 5: Await and aggregate comic gallery saves**

Import `attemptPersistence` and `fetchBlobChecked` in `src/routes/comic.tsx`. In each `handleRun`, declare before `runWithConcurrency`:

```ts
let unsaved = 0;
const saveErrors: string[] = [];
```

Replace each swallowed `addGalleryFromUrl(...).catch(() => {})` with:

```ts
const persistence = await attemptPersistence(() =>
  addGalleryFromUrl(img.url, {
    prompt: basePrompt,
    model,
    sceneName: "漫画上色",
    type: "image",
    provider: providerLabel(currentProvider()),
  }),
);
if (!persistence.saved) {
  unsaved++;
  saveErrors.push(`${page.name}: ${persistence.error.message}`);
}
```

Use `embedPrompt` and `"漫画翻译"` in the translation panel's corresponding block.

Replace unconditional completion toasts with:

```ts
if (unsaved) {
  toast.warning(`任务完成，但 ${unsaved} 张未保存到画廊：${saveErrors[0]}`);
} else {
  toast.success("任务完成并已保存到画廊");
}
```

Keep generation status successful when only persistence fails.

- [ ] **Step 6: Check comic ZIP responses and report skipped files**

In each `downloadAll`, replace `fetch` plus `blob()` with `fetchBlobChecked`. Track `failed` and show:

```ts
let failed = 0;
for (const page of okPages) {
  try {
    const blob = await fetchBlobChecked(page.resultUrl!);
    zip.file(`${page.name.replace(/\.[^.]+$/, "")}-colored.png`, blob);
  } catch {
    failed++;
  }
}
saveAs(await zip.generateAsync({ type: "blob" }), `comic-colorized-${Date.now()}.zip`);
if (failed) toast.warning(`压缩包已生成，但 ${failed} 个结果获取失败`);
```

In the translation panel use this complete block:

```ts
let failed = 0;
for (const page of okPages) {
  try {
    const blob = await fetchBlobChecked(page.resultUrl!);
    zip.file(`${page.name.replace(/\.[^.]+$/, "")}-translated.png`, blob);
    if (page.translation) {
      zip.file(`${page.name.replace(/\.[^.]+$/, "")}-translation.txt`, page.translation);
    }
  } catch {
    failed++;
  }
}
saveAs(await zip.generateAsync({ type: "blob" }), `comic-translated-${Date.now()}.zip`);
if (failed) toast.warning(`压缩包已生成，但 ${failed} 个结果获取失败`);
```

Do not add an image entry to the ZIP when checked fetch throws.

- [ ] **Step 7: Run all Node tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 20 tests, 0 failures.

- [ ] **Step 8: Commit comic persistence feedback**

```powershell
git add src/lib/persistence.ts src/lib/persistence.test.ts src/routes/comic.tsx
git commit -m "fix: report comic persistence failures"
```

## Task 7: Full Verification and Review

**Files:**

- Review: all files changed in Tasks 1-6

- [ ] **Step 1: Verify the dependency-free regression suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS, 20 tests, 0 failures. The Node experimental type-stripping warning is expected; test failures or unhandled rejections are not.

- [ ] **Step 2: Install locked dependencies without lifecycle scripts**

Run:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
```

Expected: dependencies install from `package-lock.json`. If network access still stalls or `miniflare` remains unavailable, record the exact failure and continue only with checks whose executables exist; do not claim skipped checks passed.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: exit 0, no ESLint errors.

- [ ] **Step 4: Run TypeScript checking**

Run:

```powershell
npm.cmd exec tsc -- --noEmit
```

Expected: exit 0, no TypeScript errors.

- [ ] **Step 5: Run the production build**

Run:

```powershell
npm.cmd run build
```

Expected: exit 0 and production output generated successfully.

- [ ] **Step 6: Verify formatting and repository state**

Run:

```powershell
git diff --check
git status --short --branch
git log --oneline --decorate -7
```

Expected: `git diff --check` has no output; status contains only intentional implementation changes, or is clean after task commits.

- [ ] **Step 7: Review behavior against the design checklist**

Confirm each item with a test or direct code path:

```text
HF model is provider-owned.
Saved defaults reach all intended store slices.
Provider error bodies are read once.
Non-2xx media never enters IndexedDB or ZIP files.
ModelScope polling times out and aborts.
Text-to-image and fanart expose cancellation.
Gallery object URLs revoke on removal and unmount.
Comic generation reports unsaved and skipped results.
No provider, pool, or reverse-channel integration was added.
```

- [ ] **Step 8: Commit any verification-only corrections**

If verification required a code correction, first add a failing regression test, then fix it, rerun all checks, and commit only those files:

```powershell
git add -u
git commit -m "fix: address provider repair verification"
```

If no correction was needed, do not create an empty commit.
