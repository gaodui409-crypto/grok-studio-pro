import assert from "node:assert/strict";
import test from "node:test";
import { catalogModels, inferenceParams, resolveDimensions } from "./provider-catalog.ts";
import { aspectToWH, nearestTier, tierEdge, type ResolutionTier } from "./settings.ts";

test("maps every tier to its pixel edge", () => {
  assert.equal(tierEdge("512"), 512);
  assert.equal(tierEdge("768"), 768);
  assert.equal(tierEdge("1k"), 1024);
  assert.equal(tierEdge("1.5k"), 1536);
  assert.equal(tierEdge("2k"), 2048);
});

test("clamps the long edge to a model ceiling while keeping the ratio", () => {
  // Z-Image-Turbo stops at 1664, so a 2k request must come down to 1664 rather
  // than being sent as 2048 and rejected.
  const { width, height } = resolveDimensions(
    "modelscope",
    "Tongyi-MAI/Z-Image-Turbo",
    "16:9",
    "2k",
  );
  assert.equal(width, 1664);
  assert.equal(height, Math.round((1664 * 9) / 16 / 8) * 8);
});

test("leaves a request below the ceiling untouched", () => {
  assert.deepEqual(resolveDimensions("gitee", "z-image-turbo", "1:1", "512"), {
    width: 512,
    height: 512,
  });
});

test("aspectToWH keeps the short edge at least 8px on extreme ratios", () => {
  const { width, height } = aspectToWH("1:1000", "512");
  assert.equal(height, 512);
  assert.ok(width >= 8, `short edge should be clamped to >= 8, got ${width}`);
});

test("aspectToWH falls back to a square for auto", () => {
  assert.deepEqual(aspectToWH("auto", "768"), { width: 768, height: 768 });
});

test("sends turbo sampler settings only to turbo models", () => {
  assert.deepEqual(inferenceParams("modelscope", "Tongyi-MAI/Z-Image-Turbo"), {
    num_inference_steps: 9,
    guidance_scale: 0,
  });
  // The old code sent steps 9 / guidance 0 to every model, which under-denoises
  // a standard model like SDXL.
  assert.deepEqual(inferenceParams("modelscope", "stabilityai/stable-diffusion-xl-base-1.0"), {
    num_inference_steps: 30,
    guidance_scale: 7.5,
  });
});

test("returns no sampler settings for an unknown model", () => {
  assert.deepEqual(inferenceParams("gitee", "some-model-added-next-week"), {});
});

test("AI Horde ships no curated catalog because every model is fetchable", () => {
  assert.deepEqual(catalogModels("aihorde"), []);
});

test("narrows a tier onto the ones a provider accepts", () => {
  const xai: readonly ResolutionTier[] = ["1k", "2k"];
  assert.equal(nearestTier("512", xai), "1k");
  assert.equal(nearestTier("768", xai), "1k");
  assert.equal(nearestTier("2k", xai), "2k");

  const pixai: readonly ResolutionTier[] = ["1k", "1.5k"];
  assert.equal(nearestTier("2k", pixai), "1.5k");
  assert.equal(nearestTier("512", pixai), "1k");
});

test("an equidistant tier rounds up rather than losing resolution", () => {
  // 1.5k (1536) sits exactly between 1k (1024) and 2k (2048). Rounding down
  // would silently give the user a smaller image than the one they picked.
  assert.equal(nearestTier("1.5k", ["1k", "2k"]), "2k");
  assert.equal(nearestTier("1.5k", ["2k", "1k"]), "2k");
});
