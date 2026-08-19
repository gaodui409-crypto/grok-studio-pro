# PixAI 网页 Token Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-supplied PixAI web Bearer Token GraphQL image provider while clearly separating it from the paid/approval-based official API and the unverified account-pool endpoint.

**Architecture:** Keep the existing `ImageProviderAdapter` contract. Put GraphQL transport and polling in a dependency-injected `pixai-web-client.ts`; keep settings-to-request mapping in `providers/pixai-web.ts`; register the provider independently as `pixai-web`. Do not implement login, token extraction, account rotation, credit claiming, or private pool automation.

**Tech Stack:** TypeScript, Node built-in test runner, React settings form, localStorage settings, browser `fetch`.

---

### Task 1: Clarify Official PixAI Key Status

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`
- Modify: `src/routes/settings.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write the failing catalog assertion**

Extend the existing provider/settings tests so the official provider description contains `需申请` and `免费额度未知`, while the web provider is not yet present. Add the expected `pixai-web` catalog ID only in the task that registers it, so this task's failure is limited to the missing official wording.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run `node --experimental-strip-types --test src/lib/settings.test.ts`.
Expected: FAIL because the current `pixai` description still says only “使用 PixAI v2 API Key”.

- [ ] **Step 3: Make the smallest wording change**

Change the `pixai` provider description to `需申请 PixAI v2 API Key；公开免费额度未知，异步生成图片，仅文生图。`.
In the settings form, add the same warning below the official API Key input. In README's channel table, setup section, and FAQ, state that a Key is not an automatically free/public credential and that the project has no confirmed free quota.

- [ ] **Step 4: Run the focused test and full test suite**

Run `node --experimental-strip-types --test src/lib/settings.test.ts`, then `npm test`.
Expected: both exit 0; no provider IDs change yet.

- [ ] **Step 5: Commit**

Run `git add src/lib/settings.ts src/lib/settings.test.ts src/routes/settings.tsx README.md` and commit with `docs: clarify PixAI API key availability`.

### Task 2: Implement the GraphQL Client with TDD

**Files:**
- Create: `src/lib/pixai-web-client.ts`
- Create: `src/lib/pixai-web-client.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Export `PIXAI_WEB_GRAPHQL_URL`, `PixAiWebGenerationInput`, `PixAiWebClientDependencies`, and `runPixAiWebGeneration`. The input includes `token`, `prompt`, `modelId`, `width`, `height`, optional `n`, and optional `signal`; dependencies include injectable `fetch`, `sleep`, `now`, `pollIntervalMs`, and `timeoutMs`.

Write tests for these exact behaviors:

```ts
test("creates a GraphQL task with bearer authentication", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "web-task" } } }),
    jsonResponse({ data: { task: { id: "web-task", status: "completed", outputs: { mediaId: "media-1" } } } }),
    jsonResponse({ data: { media: { fileUrl: "https://cdn.example/fox.png", urls: [] } } }),
  ];
  const result = await runPixAiWebGeneration(
    { token: "web-token", prompt: "fox", modelId: "model-1", width: 1024, height: 1024 },
    { fetch: async (input, init) => { requests.push({ url: String(input), init }); return responses.shift()!; }, sleep: async () => {} },
  );
  assert.deepEqual(result, [{ url: "https://cdn.example/fox.png", mime_type: "image/png" }]);
  assert.equal(requests[0].url, PIXAI_WEB_GRAPHQL_URL);
  assert.equal(new Headers(requests[0].init?.headers).get("authorization"), "Bearer web-token");
  const body = JSON.parse(String(requests[0].init?.body));
  assert.equal(body.variables.parameters.prompts, "fox");
  assert.equal(body.variables.parameters.modelId, "model-1");
});
```

Also cover pending-to-success polling, `outputs.batch` media IDs, `PUBLIC` URL preference, GraphQL `errors`, failed statuses, empty results, serial `n: 2`, deadline timeout, already-aborted signal, and blank token rejecting before fetch.

- [ ] **Step 2: Run the focused test and confirm RED**

Run `node --experimental-strip-types --test src/lib/pixai-web-client.test.ts`.
Expected: FAIL because `src/lib/pixai-web-client.ts` does not exist.

- [ ] **Step 3: Implement minimal GraphQL transport**

Use `POST` for all operations with JSON `{ query, variables }`. Parse both HTTP errors and GraphQL `{ errors: [{ message }] }`; never return an empty success for an error response. Use these minimal operations:

```graphql
mutation CreateGenerationTask($parameters: JSONObject!) {
  createGenerationTask(parameters: $parameters) { id status outputs }
}
query GetTask($id: ID!) {
  task(id: $id) { id status outputs }
}
query GetMedia($id: String!) {
  media(id: $id) { fileUrl urls { variant url } }
}
```

Use defaults `negativePrompts: ""`, `samplingSteps: 25`, `samplingMethod: "Euler a"`, `cfgScale: 6`, `clipSkip: 1`, `priority: 1000`, `extra: {}`, and `controlNets: []`. Submit one task per requested image. Poll at least 1500 ms by default, with a ten-minute task deadline and AbortController forwarding. Treat `waiting`, `pending`, `started`, `processing`, `running`, `queued` as pending; `completed`, `success`, `succeeded`, `done` as success; and `failed`, `error`, `cancelled`, `canceled` as failure.

Extract media IDs from `outputs.mediaId`, `outputs.batch[].mediaId`, and nested `outputs.batch[].media_id`. For each ID, call `media`; choose a `PUBLIC` URL first, then `fileUrl`, then the first non-empty URL. Infer `mime_type` from the URL suffix as the existing PixAI client does.

- [ ] **Step 4: Run focused and full tests**

Run `node --experimental-strip-types --test src/lib/pixai-web-client.test.ts` and `npm test`.
Expected: all new and existing tests pass.

- [ ] **Step 5: Commit**

Run `git add src/lib/pixai-web-client.ts src/lib/pixai-web-client.test.ts` and commit with `feat: add PixAI web GraphQL client`.

### Task 3: Register Provider, Settings, and Documentation

**Files:**
- Create: `src/lib/providers/pixai-web.ts`
- Create: `src/lib/providers/pixai-web.test.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`
- Modify: `src/lib/providers/index.ts`
- Modify: `src/lib/providers/registry.test.ts`
- Modify: `src/routes/settings.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write failing adapter and registry tests**

Add the `pixai-web` Provider ID and tests asserting it is listed, has `{ t2i: true, i2i: false, video: false }`, has blank `pixaiWebToken` and blank `pixaiWebModelId`, and reports `PixAI 网页 Token` first and `PixAI 网页模型 ID` after a Token is present. Add a registry assertion for label `PixAI 网页 Token（实验性）`.

In `pixai-web.test.ts`, test `pixAiWebDimensions("16:9", "1k")` returns 1024x576 and `pixAiWebDimensions("9:16", "2k")` returns 864x1536, and stub the client boundary through the existing injected fetch pattern so the adapter maps settings into `runPixAiWebGeneration` without using the official API key.

- [ ] **Step 2: Run focused tests and confirm RED**

Run `node --experimental-strip-types --test src/lib/settings.test.ts src/lib/providers/registry.test.ts src/lib/providers/pixai-web.test.ts`.
Expected: FAIL because the new Provider ID, settings fields, adapter, and registry entry do not exist.

- [ ] **Step 3: Implement settings and adapter**

Add `pixai-web` to the Provider ID union and catalog. Add blank `pixaiWebToken` and blank `pixaiWebModelId` fields to `Settings` and `defaultSettings`. Make `providerSetupIssue` require both a non-blank web token and a non-blank web model ID. Map the shared aspect/resolution to dimensions with longest side 1024 for `1k` and 1536 for `2k`, rounded to 64-pixel multiples; reject `auto` with a clear message. The adapter reads settings and calls `runPixAiWebGeneration` with the prompt, model ID, dimensions, n, and signal.

Register `pixAiWebImageProvider` after the official PixAI provider and keep `pixai-pool` blocked. Do not reuse `pixaiApiKey` or silently fall back between the two PixAI channels.

- [ ] **Step 4: Add the settings UI**

When `draft.provider === "pixai-web"`, render a password input for `pixaiWebToken` and a required text input for `pixaiWebModelId`. Do not reuse the official Tsubaki.2 model-version preset: official REST `modelVersionId` and web GraphQL `modelId` are different identifiers. Explain that both values must be copied manually from the user's own PixAI web session, the token is stored only in browser localStorage, can expire, and is not an official API Key. Do not provide automation to read browser storage or log in.

- [ ] **Step 5: Update README**

Add `PixAI 网页 Token（实验性）` to the channel table and configuration instructions. Explain the manual token boundary, account credits/free quota are controlled by PixAI and not guaranteed, one-image-at-a-time behavior, possible CORS or schema changes, and that a real token is required for acceptance. Keep `PixAI 号池` marked as awaiting HAR/Network evidence.

- [ ] **Step 6: Run all verification**

Run `node --experimental-strip-types --test src/lib/settings.test.ts src/lib/providers/registry.test.ts src/lib/providers/pixai-web.test.ts`, then `npm test`, `npm exec tsc -- --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.
Expected: exit code 0 for all commands; no changed files outside this plan and the existing untracked total-control note.

- [ ] **Step 7: Commit**

Run `git add src/lib/providers/pixai-web.ts src/lib/providers/pixai-web.test.ts src/lib/settings.ts src/lib/settings.test.ts src/lib/providers/index.ts src/lib/providers/registry.test.ts src/routes/settings.tsx README.md` and commit with `feat: add PixAI web token provider`.

### Task 4: Final Review and Delivery

**Files:**
- No new production files; review the files above and preserve `1.3 GSP 总控笔记.md`.

- [ ] **Step 1: Inspect the final diff and status**

Run `git diff --check`, `git status --short --branch`, and `git diff --stat main..HEAD`. Confirm no token, cookie, HAR, or generated dependency artifacts are tracked.

- [ ] **Step 2: Perform independent review**

Review for protocol correctness, token safety, CORS disclosure, provider separation, serial concurrency, and error handling. Any issue must be fixed and re-tested before delivery.

- [ ] **Step 3: Push the feature branch**

Run `git push` after verification. Report the branch URL and explicitly state that real PixAI web generation and CORS remain unverified without a user token.
