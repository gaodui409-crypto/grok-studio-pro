import assert from "node:assert/strict";
import test from "node:test";
import { MODELSCOPE_IMAGE_MODEL, resolveImageModel } from "./provider-runtime.ts";
import { defaultSettings } from "./settings.ts";

test("xAI uses the saved channel model when a page model is selected", () => {
  assert.equal(
    resolveImageModel("xai", "grok-imagine-image", {
      ...defaultSettings,
      imageModel: "grok-imagine-image",
    }),
    "grok-imagine-image",
  );
});

test("xAI falls back to its saved model", () => {
  assert.equal(resolveImageModel("xai", undefined, defaultSettings), defaultSettings.imageModel);
});

test("xAI ignores stale page model when the saved channel model changed", () => {
  const settings = { ...defaultSettings, imageModel: "grok-imagine-image" };
  assert.equal(resolveImageModel("xai", "grok-imagine-image-pro", settings), "grok-imagine-image");
});

test("ModelScope honours a model from its own catalog", () => {
  assert.equal(
    resolveImageModel("modelscope", "black-forest-labs/FLUX.1-schnell", defaultSettings),
    "black-forest-labs/FLUX.1-schnell",
  );
});

test("ModelScope ignores a model belonging to another provider", () => {
  // Page state is shared across providers, so it can still hold a grok id after
  // switching. Sending that to ModelScope would fail, so the saved model wins.
  assert.equal(
    resolveImageModel("modelscope", "grok-imagine-image-pro", defaultSettings),
    defaultSettings.modelscopeModel,
  );
});

test("ModelScope falls back to its supported model when nothing is saved", () => {
  assert.equal(
    resolveImageModel("modelscope", undefined, { ...defaultSettings, modelscopeModel: "" }),
    MODELSCOPE_IMAGE_MODEL,
  );
});

test("reads the per-provider model field for the other channels", () => {
  const settings = { ...defaultSettings, giteeModel: "FLUX.2-dev", aiHordeModel: "AAM XL" };
  assert.equal(resolveImageModel("gitee", undefined, settings), "FLUX.2-dev");
  assert.equal(resolveImageModel("aihorde", undefined, settings), "AAM XL");
});

test("returns an empty model for the provider that has no model choice", () => {
  assert.equal(resolveImageModel("pixai-pool", undefined, defaultSettings), "");
});
