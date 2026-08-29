# Provider Adapter Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract current image transports into registered provider adapters without changing route-facing behavior.

**Architecture:** Define a small image-only adapter contract, register the current providers, and retain `src/lib/xai.ts` as a compatibility facade. Provider modules own protocol details; future pool orchestration will sit above the registry.

**Tech Stack:** TypeScript, Node test runner, React/TanStack Start, browser Fetch API.

---

## File Structure

- `src/lib/providers/types.ts`: common image requests, results, and adapter contract.
- `src/lib/providers/registry.ts`: concrete provider lookup, labels, and image-edit capability guard.
- `src/lib/providers/registry.test.ts`: registry and capability regression tests.
- `src/lib/providers/xai.ts`: xAI/NewAPI image generation and editing transport.
- `src/lib/providers/modelscope.ts`: ModelScope image generation and polling transport.
- `src/lib/providers/hugging-face.ts`: Hugging Face image generation transport.
- `src/lib/xai.ts`: route-compatible facade plus unchanged video/chat utilities.

### Task 1: Provider Contract and Registry

**Files:**

- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/registry.ts`
- Test: `src/lib/providers/registry.test.ts`

- [x] **Step 1: Write failing registry tests**

Test that `getImageProviderAdapter()` resolves `xai`, `modelscope`, and `hf`, and that `requireImageEditingAdapter()` accepts xAI but rejects the other providers with their labels.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test src/lib/providers/registry.test.ts`

Expected: FAIL because `registry.ts` does not exist.

- [x] **Step 3: Implement the minimal contract and registry**

Define the contract in `types.ts`:

```ts
import type { ProviderId } from "../settings.ts";

export type ImageGenParams = {
  prompt: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: "1k" | "2k";
  model?: string;
  signal?: AbortSignal;
};

export type ImageEditParams = {
  prompt: string;
  images: string[];
  n?: number;
  resolution?: "1k" | "2k";
  model?: string;
  signal?: AbortSignal;
};

export type GeneratedImage = {
  url: string;
  revised_prompt?: string;
  mime_type?: string;
};

export type ImageProviderAdapter = {
  id: ProviderId;
  label: string;
  generateImages(params: ImageGenParams): Promise<GeneratedImage[]>;
  editImages?(params: ImageEditParams): Promise<GeneratedImage[]>;
};
```

Implement `createImageProviderRegistry(adapters)` in `registry.ts`. It returns `get(id)` and `requireImageEditing(id)`, rejects duplicate IDs at construction, throws `未注册的图片来源：<id>` for missing IDs, and preserves the current unsupported-edit message using the adapter label.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --experimental-strip-types --test src/lib/providers/registry.test.ts`

Expected: all registry tests pass.

### Task 2: Extract Current Image Transports

**Files:**

- Create: `src/lib/providers/xai.ts`
- Create: `src/lib/providers/xai-client.ts`
- Create: `src/lib/providers/modelscope.ts`
- Create: `src/lib/providers/hugging-face.ts`
- Create: `src/lib/providers/index.ts`
- Modify: `src/lib/xai.ts`

- [x] **Step 1: Move common image types to the contract**

Remove the three image type declarations from `src/lib/xai.ts` and preserve compatibility with:

```ts
import type { ImageEditParams, ImageGenParams } from "./providers/types.ts";
export type { GeneratedImage, ImageEditParams, ImageGenParams } from "./providers/types.ts";
```

- [x] **Step 2: Move xAI/NewAPI image generation and editing**

Create `xai-client.ts` with the current checked JSON request logic, exported as:

```ts
export async function xaiRequest<T>(path: string, init: RequestInit): Promise<T>;
```

Create `xai.ts` exporting `xaiImageProvider`. Preserve the current `/v1/images/generations` and `/v1/images/edits` payloads, authorization, response normalization, model selection, and abort signals. The adapter has `id: "xai"`, `label: "xAI/NewAPI"`, and both image methods.

- [x] **Step 3: Move ModelScope image generation**

Create `modelscope.ts` exporting `modelScopeImageProvider` with `id: "modelscope"`, `label: "魔搭 ModelScope"`, and `generateImages`. Preserve fixed model selection, size mapping, sequential `n` behavior, task polling, terminal error handling, timeout, and abort signals. Do not define `editImages`.

- [x] **Step 4: Move Hugging Face image generation**

Create `hugging-face.ts` exporting `huggingFaceImageProvider` with `id: "hf"`, `label: "Hugging Face"`, and `generateImages`. Preserve model ownership, size mapping, random seed, sequential `n` behavior, checked blob response, and data-URI conversion. Do not define `editImages`.

- [x] **Step 5: Delegate through the registry facade**

Create `providers/index.ts`:

```ts
export const imageProviderRegistry = createImageProviderRegistry([
  xaiImageProvider,
  modelScopeImageProvider,
  huggingFaceImageProvider,
]);
```

Use this exact compatibility delegation in `src/lib/xai.ts`:

```ts
export async function generateImages(p: ImageGenParams) {
  return imageProviderRegistry.get(currentProvider()).generateImages(p);
}

export async function editImages(p: ImageEditParams) {
  return imageProviderRegistry.requireImageEditing(currentProvider()).editImages(p);
}
```

Replace the local JSON `request()` calls used by video/chat/status functions with `xaiRequest()`; their payloads and return types stay unchanged.

- [x] **Step 6: Run the complete unit test suite**

Run: `npm.cmd test`

Expected: registry tests and the existing 21 tests pass with zero failures.

### Task 3: Compatibility Verification

**Files:**

- Modify only files required by type/build feedback.

- [x] **Step 1: Run TypeScript**

Run: `node node_modules/typescript/bin/tsc --noEmit`

Expected: exit code 0.

- [x] **Step 2: Run production build**

Run: `node node_modules/vite/bin/vite.js build`

Expected: client and SSR builds complete.

- [x] **Step 3: Inspect final diff**

Confirm routes, settings schema, and UI files are unchanged; confirm no account-pool or fallback behavior was added.

- [x] **Step 4: Commit the increment**

Stage the design, plan, tests, adapter modules, and compatibility facade. Do not commit the temporary root planning logs. Commit with `refactor: extract image provider adapters`.
