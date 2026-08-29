# Provider Reliability Repair Design

## Context

Grok Studio currently supports xAI/NewAPI, ModelScope, and Hugging Face from browser-side code. The latest multi-provider change introduced model-selection and settings propagation regressions, while existing media persistence and polling paths have several reliability defects.

The longer-term direction may aggregate multiple free or reverse-engineered channels. Those channels are not yet selected, so this repair must improve the current boundaries without inventing a generic protocol for unknown providers.

## Scope

This change fixes all seven confirmed review findings:

1. Hugging Face requests use the xAI page model instead of the configured HF model.
2. Saved default models, image resolution, and aspect ratio do not reach page state.
3. ModelScope polling can run forever and cannot be cancelled.
4. Remote media fetches accept non-2xx responses as valid blobs.
5. Gallery object URLs are not reliably revoked.
6. Comic gallery persistence failures are hidden from users.
7. Plain-text provider error bodies are discarded.

xAI remains an optional provider for compatibility. No new provider, account pool, reverse-engineered protocol, proxy, or credential-sharing feature is added.

## Goals

- Make each current provider select its own valid model configuration.
- Apply saved defaults predictably without resetting user input during ordinary navigation.
- Bound and cancel asynchronous polling.
- Reject HTTP error documents before persistence or download.
- Release browser object URLs deterministically.
- Surface persistence failures without treating generation itself as failed.
- Add dependency-free regression tests that can run on the installed Node 22 runtime.
- Leave a small, explicit provider boundary suitable for later adapters.

## Non-Goals

- A full provider plugin framework.
- Runtime provider discovery.
- Automatic fallback, load balancing, account pooling, or rate-limit rotation.
- Reverse-engineered channel implementations.
- Moving credentials to a new backend.
- General UI redesign.

## Design

### 1. Provider-specific request resolution

Add pure provider-resolution helpers. Image model resolution follows these rules:

- `xai`: use the explicitly selected xAI page model, falling back to `settings.imageModel`.
- `hf`: always use `settings.hfModel`; an xAI page model must never override it.
- `modelscope`: use its fixed supported model.

Provider functions remain responsible for translating common request fields into provider-specific payloads. Page components do not construct provider endpoints or credentials.

This is intentionally smaller than a full adapter registry. A future channel must add a provider module and configuration mapping instead of adding conditionals to page components.

### 2. Settings default propagation

Add one store action that applies saved defaults to relevant slices:

- `imageModel`: text-to-image, image editing, fanart, and both comic workflows.
- `videoModel`: video workflow only.
- `defaultAspectRatio`: text-to-image and fanart.
- `defaultResolution`: text-to-image, image editing, and fanart.

The action runs once after client startup and again immediately after the user explicitly saves settings. It does not run on ordinary route navigation, so existing prompts, uploads, results, and manual per-page selections remain stable.

Provider changes do not overwrite provider-specific credentials. HF request resolution remains independent from the xAI model stored in page state.

### 3. Provider errors and media fetching

Introduce shared response helpers:

- Error responses read the body exactly once as text.
- If that text is JSON, extract `error.message`, `error`, or `message`; otherwise preserve the text.
- Empty bodies fall back to `HTTP <status>`.
- Media fetches throw on non-2xx status before calling `blob()`.

Gallery persistence, single download, ZIP download, and comic export use the checked media helper. Batch ZIP operations report skipped files rather than silently producing an apparently complete archive.

### 4. Bounded and cancellable ModelScope polling

Extract ModelScope polling into a testable function with injected fetch/delay boundaries. It accepts an `AbortSignal`, polls every five seconds, and stops after ten minutes.

Terminal handling:

- `SUCCEED`: require at least one output image.
- `FAILED`, `CANCELED`, `CANCELLED`, `REJECTED`, or `EXPIRED`: throw a provider error.
- Other states may continue only until cancellation or timeout.

Text-to-image and fanart batch execution create an `AbortController`. While running they expose a cancel command, pass the signal through generation calls, and restore loading/running state after abort.

### 5. Gallery object URL ownership

Replace the stale closure cleanup with a small object URL registry owned by the gallery page.

- Register each created URL by gallery item ID.
- Revoke and remove a URL when its item leaves the gallery list.
- Revoke all remaining URLs on unmount.
- Never create a second URL for an already registered item.

The registry is independent of React and can be tested with injected create/revoke functions.

### 6. Comic persistence feedback

Comic generation status and gallery persistence status remain separate. A generated page stays successful even if persistence fails, but failures are counted and shown after the batch finishes.

Completion messages report generated and unsaved counts. Errors are not swallowed; detailed messages remain available for the user while manual download is still possible.

## Testing Strategy

Use Node 22's built-in test runner with TypeScript type stripping. No test framework dependency is added.

Regression tests cover:

- HF model resolution cannot be overridden by an xAI model.
- Settings map to the correct store slices and do not cross image/video boundaries.
- Plain-text and JSON provider errors retain useful messages.
- Checked blob fetching rejects 4xx/5xx responses.
- ModelScope polling succeeds, rejects known terminal failures, times out, and aborts.
- Object URLs are reused, removed individually, and fully revoked on disposal.
- Comic persistence aggregation reports failed saves.

Each production change follows red-green-refactor. After focused tests pass, run the complete test command, lint, TypeScript checking, and production build. If dependency installation is still unavailable, the Node-only regression suite remains mandatory and the missing dependency-based checks are reported explicitly.
