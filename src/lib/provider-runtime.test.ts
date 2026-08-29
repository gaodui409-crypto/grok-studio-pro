import assert from "node:assert/strict";
import test from "node:test";
import { MODELSCOPE_IMAGE_MODEL, resolveImageModel } from "./provider-runtime.ts";

const models = {
  xai: "grok-imagine-image-pro",
};

test("xAI uses the page model when one is selected", () => {
  assert.equal(resolveImageModel("xai", "grok-imagine-image", models), "grok-imagine-image");
});

test("xAI falls back to its saved model", () => {
  assert.equal(resolveImageModel("xai", undefined, models), models.xai);
});

test("ModelScope always uses its supported model", () => {
  assert.equal(
    resolveImageModel("modelscope", "grok-imagine-image-pro", models),
    MODELSCOPE_IMAGE_MODEL,
  );
});
