# Free Provider Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI Horde and Pollinations image generation plus a transparent PixAI pool protocol boundary to the existing provider registry.

**Architecture:** Extend the existing image-provider adapter system with provider-owned transports. Keep async polling isolated and testable, keep route APIs unchanged, and reject PixAI pool generation before network I/O until its real private request contract is supplied.

**Tech Stack:** TypeScript, Node test runner, React 19, TanStack Start, browser Fetch API.

---

## File Structure

- `src/lib/ai-horde-client.ts`: async submit/check/status orchestration.
- `src/lib/ai-horde-client.test.ts`: AI Horde request and polling behavior.
- `src/lib/providers/ai-horde.ts`: settings-owned AI Horde adapter.
- `src/lib/pollinations.ts`: URL construction and image response helpers.
- `src/lib/pollinations.test.ts`: Pollinations request contract tests.
- `src/lib/providers/pollinations.ts`: Pollinations adapter.
- `src/lib/providers/pixai-pool.ts`: explicit protocol-readiness guard.
- `src/lib/providers/pixai-pool.test.ts`: no-network protocol error test.
- `src/lib/settings.ts`: IDs, catalog, capabilities, and persisted fields.
- `src/routes/settings.tsx`: conditional configuration controls.
- `src/components/api-key-banner.tsx`: missing-configuration messages.
- `src/lib/providers/index.ts`: adapter registration.

### Task 1: AI Horde Client and Adapter

**Files:**

- Create: `src/lib/ai-horde-client.test.ts`
- Create: `src/lib/ai-horde-client.ts`
- Create: `src/lib/providers/ai-horde.ts`

- [x] **Step 1: Write failing protocol tests**

Test `runAiHordeGeneration()` with an injected fetch and wait function. Assert `POST /api/v2/generate/async` receives `prompt`, `params.n`, dimensions, `r2: true`, `apikey`, and `Client-Agent`; assert check polling precedes status retrieval and returns the generation URL.

- [x] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test src/lib/ai-horde-client.test.ts`

Expected: FAIL because `ai-horde-client.ts` does not exist.

- [x] **Step 3: Implement the minimal async client**

Define `runAiHordeGeneration(input, dependencies)` with bounded polling, abort checks, checked responses, fault handling, and result normalization. The adapter maps aspect ratio with `aspectToWH()`, defaults an empty key to `0000000000`, and submits one requested batch.

- [x] **Step 4: Verify GREEN**

Run the focused test and expect all AI Horde cases to pass.

### Task 2: Pollinations Client and Adapter

**Files:**

- Create: `src/lib/pollinations.test.ts`
- Create: `src/lib/pollinations.ts`
- Create: `src/lib/providers/pollinations.ts`

- [x] **Step 1: Write failing URL and validation tests**

Assert `buildPollinationsImageUrl()` encodes prompt path content and emits `key`, `model`, `width`, `height`, `nologo=true`, `private=true`, and a per-request seed. Assert the adapter-level settings validator rejects an empty key before fetch.

- [x] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test src/lib/pollinations.test.ts`

Expected: FAIL because `pollinations.ts` does not exist.

- [x] **Step 3: Implement minimal URL and binary response behavior**

Build URLs through `URL`/`URLSearchParams`, validate the key, fetch one image per requested output serially, check HTTP status, and convert each blob to a data URI.

- [x] **Step 4: Verify GREEN**

Run the focused test and expect all Pollinations cases to pass.

### Task 3: PixAI Pool Boundary

**Files:**

- Create: `src/lib/providers/pixai-pool.test.ts`
- Create: `src/lib/providers/pixai-pool.ts`

- [x] **Step 1: Write a failing no-network test**

Call `generateImages()` and assert it rejects with a message naming HAR/Network request details while an injected/global fetch remains untouched.

- [x] **Step 2: Verify RED**

Run the focused test and expect module-not-found failure.

- [x] **Step 3: Implement the readiness guard**

Register `id: "pixai-pool"`, label it `PixAI 号池`, and reject immediately with the protocol evidence requirement. Store the base site URL only as migration-ready configuration.

- [x] **Step 4: Verify GREEN**

Run the focused test and expect the protocol guard case to pass.

### Task 4: Settings, Catalog, and Registry

**Files:**

- Modify: `src/lib/settings.ts`
- Modify: `src/lib/provider-runtime.ts`
- Modify: `src/lib/provider-runtime.test.ts`
- Modify: `src/lib/providers/registry.test.ts`
- Modify: `src/lib/providers/index.ts`
- Modify: `src/routes/settings.tsx`
- Modify: `src/components/api-key-banner.tsx`

- [x] **Step 1: Write failing catalog and registry assertions**

Extend tests to resolve all six providers and prove non-xAI providers do not inherit the xAI page model.

- [x] **Step 2: Verify RED**

Run the focused registry/runtime tests and expect type or assertion failures for the missing IDs.

- [x] **Step 3: Extend settings and registry**

Add `aiHordeApiKey`, `pollinationsApiKey`, `pollinationsModel`, and `pixaiPoolBaseUrl` defaults; add text-to-image-only capabilities and register all adapters.

- [x] **Step 4: Extend the existing settings UI**

Add conditional fields and honest provider copy. AI Horde shows anonymous fallback, Pollinations shows required key/model, and PixAI pool shows the saved URL plus the protocol-capture requirement.

- [x] **Step 5: Verify GREEN**

Run all focused tests, TypeScript, and targeted ESLint on modified files.

### Task 5: Full Verification and Commit

- [x] **Step 1: Run all tests**

Run: `npm.cmd test`

Expected: zero failures.

- [x] **Step 2: Run static and production checks**

Run TypeScript `--noEmit`, targeted ESLint, and `vite build`; require exit code 0 from each.

- [x] **Step 3: Inspect the settings page locally**

Start Vite on an available local port and verify all three new provider selections render without overlap at desktop and mobile widths.

- [x] **Step 4: Inspect final diff and commit**

Confirm no private PixAI endpoint was fabricated and no unrelated files changed. Commit product files and the two docs with `feat: add free image provider channels`.
