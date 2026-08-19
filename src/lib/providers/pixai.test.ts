import assert from "node:assert/strict";
import test from "node:test";
import { pixAiAspectRatio, pixAiSizeFromResolution } from "./pixai.ts";

test("maps shared resolution tiers to PixAI v2 size values", () => {
  assert.equal(pixAiSizeFromResolution("1k"), "1k");
  assert.equal(pixAiSizeFromResolution("2k"), "1.5k");
});

test("accepts only aspect ratios supported by PixAI v2", () => {
  assert.equal(pixAiAspectRatio("1:1"), "1:1");
  assert.equal(pixAiAspectRatio("16:9"), "16:9");
  assert.throws(() => pixAiAspectRatio("2:1"), /PixAI 不支持画面比例：2:1/);
  assert.throws(() => pixAiAspectRatio("1:2"), /PixAI 不支持画面比例：1:2/);
  assert.throws(() => pixAiAspectRatio("auto"), /PixAI 不支持画面比例：auto/);
});
