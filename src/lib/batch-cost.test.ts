import { test } from "node:test";
import assert from "node:assert/strict";
import { batchCost, perImageUsd, quotaNote } from "./batch-cost.ts";
import { PROVIDERS } from "./settings.ts";

test("xAI is priced per image, and the Pro model costs more", () => {
  assert.equal(perImageUsd("xai", "grok-imagine-image-pro"), 0.07);
  assert.equal(perImageUsd("xai", "grok-imagine-image"), 0.04);
});

test("a batch multiplies the per-image price", () => {
  const cost = batchCost("xai", "grok-imagine-image-pro", 24);
  assert.deepEqual(cost, { kind: "paid", usd: 0.07 * 24, perImage: 0.07 });
});

// The bug this module exists for: 24 images on Gitee's free daily 100 used to be
// reported as $1.68, because the page multiplied by xAI's price regardless of
// which channel was selected.
test("free channels report no charge instead of xAI's price", () => {
  for (const provider of ["gitee", "modelscope", "aihorde", "pollinations"] as const) {
    assert.deepEqual(batchCost(provider, "anything", 24), { kind: "free" }, provider);
    assert.equal(perImageUsd(provider, "anything"), null, provider);
  }
});

test("channels with undocumented allowances say so rather than guessing", () => {
  assert.deepEqual(batchCost("pixai", "x", 5), { kind: "unknown" });
  assert.deepEqual(batchCost("pixai-pool", "x", 5), { kind: "unknown" });
});

test("a zero-image batch costs nothing", () => {
  assert.deepEqual(batchCost("xai", "grok-imagine-image-pro", 0), {
    kind: "paid",
    usd: 0,
    perImage: 0.07,
  });
});

test("every provider in the catalogue is classified", () => {
  for (const provider of PROVIDERS) {
    const cost = batchCost(provider.id, "grok-imagine-image-pro", 1);
    assert.ok(
      cost.kind === "paid" || cost.kind === "free" || cost.kind === "unknown",
      `${provider.id} fell through`,
    );
    // A free or unknown batch is shown alongside the channel's own allowance
    // note, so an empty note would leave the panel saying nothing at all.
    if (cost.kind !== "paid") {
      assert.notEqual(quotaNote(provider.id), "", `${provider.id} has no quota text`);
    }
  }
});
