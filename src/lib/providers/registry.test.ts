import assert from "node:assert/strict";
import test from "node:test";
import { createImageProviderRegistry } from "./registry.ts";
import type { ImageProviderAdapter } from "./types.ts";
import { PROVIDERS, type ProviderId } from "../settings.ts";
import { imageProviderRegistry } from "./index.ts";

function stubAdapter(id: ProviderId, label: string, supportsEditing = false): ImageProviderAdapter {
  return {
    id,
    label,
    async generateImages() {
      return [];
    },
    ...(supportsEditing
      ? {
          async editImages() {
            return [];
          },
        }
      : {}),
  };
}

const xai = stubAdapter("xai", "xAI/NewAPI", true);
const modelscope = stubAdapter("modelscope", "魔搭 ModelScope");
const hf = stubAdapter("hf", "Hugging Face");

test("resolves every registered image provider", () => {
  const registry = createImageProviderRegistry([xai, modelscope, hf]);

  assert.equal(registry.get("xai"), xai);
  assert.equal(registry.get("modelscope"), modelscope);
  assert.equal(registry.get("hf"), hf);
});

test("rejects an unregistered image provider", () => {
  const registry = createImageProviderRegistry([xai]);

  assert.throws(() => registry.get("missing" as ProviderId), /未注册的图片来源：missing/);
});

test("returns an adapter that supports image editing", () => {
  const registry = createImageProviderRegistry([xai]);

  assert.equal(registry.requireImageEditing("xai"), xai);
});

test("reports the selected provider when image editing is unsupported", () => {
  const registry = createImageProviderRegistry([modelscope, hf]);

  assert.throws(
    () => registry.requireImageEditing("modelscope"),
    /当前来源（魔搭 ModelScope）不支持图生图/,
  );
  assert.throws(() => registry.requireImageEditing("hf"), /当前来源（Hugging Face）不支持图生图/);
});

test("rejects duplicate provider registrations", () => {
  assert.throws(() => createImageProviderRegistry([xai, xai]), /重复的图片来源：xai/);
});

test("registers every production image provider", () => {
  for (const provider of PROVIDERS) {
    assert.equal(imageProviderRegistry.get(provider.id).id, provider.id);
  }

  assert.equal(imageProviderRegistry.get("aihorde" as ProviderId).label, "AI Horde");
  assert.equal(imageProviderRegistry.get("pollinations" as ProviderId).label, "Pollinations");
  assert.equal(imageProviderRegistry.get("pixai" as ProviderId).label, "PixAI 官方 API");
  assert.equal(
    imageProviderRegistry.get("pixai-web" as ProviderId).label,
    "PixAI 网页 Token（实验性）",
  );
  assert.equal(imageProviderRegistry.get("pixai-pool" as ProviderId).label, "PixAI 号池");
});
