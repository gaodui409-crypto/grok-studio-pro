import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "./settings.ts";
import {
  clampTier,
  currentModelId,
  currentResolutionLimit,
  resolutionLimit,
} from "./resolution-limits.ts";

test("a model with maxEdge disables the tiers above it", () => {
  // Z-Image-Turbo tops out at 1664, so 2k must be off but 1.5k must stay on.
  const limit = resolutionLimit("modelscope", "Tongyi-MAI/Z-Image-Turbo");
  assert.equal(limit.maxEdge, 1664);
  assert.equal(limit.source, "model");
  assert.equal(limit.tiers.find((t) => t.id === "1.5k")?.enabled, true);
  assert.equal(limit.tiers.find((t) => t.id === "2k")?.enabled, false);
  assert.equal(limit.highest, "1.5k");
});

test("the disabled note names the actual ceiling", () => {
  const limit = resolutionLimit("modelscope", "stabilityai/stable-diffusion-xl-base-1.0");
  assert.equal(limit.maxEdge, 1024);
  assert.match(limit.tiers.find((t) => t.id === "1.5k")?.note ?? "", /1024/);
});

test("an unknown model gets no ceiling rather than a guessed one", () => {
  // Live-fetched and hand-typed ids are not in the catalog. Greying out a tier
  // that would have worked is worse than letting the request path clamp it.
  const limit = resolutionLimit("gitee", "some-model-fetched-at-runtime");
  assert.equal(limit.maxEdge, null);
  assert.equal(limit.source, null);
  assert.ok(limit.tiers.every((t) => t.enabled));
  assert.equal(limit.highest, "2k");
});

test("an allowlist channel caps at its largest accepted tier", () => {
  // PixAI official accepts 1k/1.5k only, so 2k is unreachable.
  const limit = resolutionLimit("pixai", "1983308862240288769");
  assert.equal(limit.maxEdge, 1536);
  assert.equal(limit.source, "provider");
  assert.equal(limit.tiers.find((t) => t.id === "2k")?.enabled, false);
});

test("tiers under an allowlist floor stay selectable and say what they become", () => {
  // Rounding up hands back more than was asked for, so blocking it would be the
  // wrong trade — unlike a ceiling, nothing is lost.
  const limit = resolutionLimit("xai", "grok-imagine-image-pro");
  const small = limit.tiers.find((t) => t.id === "512");
  assert.equal(small?.enabled, true);
  assert.match(small?.note ?? "", /1024/);
  assert.equal(limit.tiers.find((t) => t.id === "2k")?.enabled, true);
});

test("a protocol cap applies whatever model is named", () => {
  const limit = resolutionLimit("pixai-web", "1861558740588989558");
  assert.equal(limit.maxEdge, 1536);
  assert.equal(limit.source, "provider");
  assert.equal(limit.tiers.find((t) => t.id === "2k")?.enabled, false);
});

test("the most restrictive of several caps wins", () => {
  // SDXL on Gitee: model says 1024, the channel itself allows 2048.
  const limit = resolutionLimit("gitee", "stable-diffusion-xl-base-1.0");
  assert.equal(limit.maxEdge, 1024);
  assert.equal(limit.source, "model");
  assert.equal(limit.modelId, "stable-diffusion-xl-base-1.0");
});

test("currentModelId reads the field belonging to the provider", () => {
  const settings = { ...defaultSettings, giteeModel: "Kolors" };
  assert.equal(currentModelId(settings, "gitee"), "Kolors");
  // pixai-pool has no model choice at all.
  assert.equal(currentModelId(settings, "pixai-pool"), "");
});

test("currentResolutionLimit follows the selected provider", () => {
  const settings = {
    ...defaultSettings,
    provider: "modelscope" as const,
    modelscopeModel: "Tongyi-MAI/Z-Image-Turbo",
  };
  assert.equal(currentResolutionLimit(settings).maxEdge, 1664);
});

test("clampTier steps down to the highest deliverable tier, not to a default", () => {
  const limit = resolutionLimit("modelscope", "Tongyi-MAI/Z-Image-Turbo");
  // 2k is over the ceiling; the honest fallback is 1.5k, not 1k.
  assert.equal(clampTier("2k", limit), "1.5k");
  assert.equal(clampTier("1k", limit), "1k");
});

test("clampTier leaves an under-floor tier alone", () => {
  // It is selectable by design, so clamping it would override a valid choice.
  const limit = resolutionLimit("xai", "grok-imagine-image-pro");
  assert.equal(clampTier("512", limit), "512");
});

test("a channel with no known limit clamps nothing", () => {
  const limit = resolutionLimit("pollinations", "flux");
  assert.equal(limit.maxEdge, null);
  assert.equal(clampTier("2k", limit), "2k");
});
