import { test } from "node:test";
import assert from "node:assert/strict";
import { batchCost, perImageUsd, quotaNote, videoCost } from "./batch-cost.ts";
import { IMAGE_MODELS, PROVIDERS, VIDEO_MODELS } from "./settings.ts";

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

test("video is billed per second, and 720p costs more than 480p", () => {
  assert.deepEqual(videoCost("xai", "480p", 6), { kind: "paid", usd: 0.05 * 6, perSecond: 0.05 });
  assert.deepEqual(videoCost("xai", "720p", 6), { kind: "paid", usd: 0.07 * 6, perSecond: 0.07 });
});

test("duration scales the video estimate linearly", () => {
  const short = videoCost("xai", "720p", 1);
  const long = videoCost("xai", "720p", 15);
  assert.ok(short.kind === "paid" && long.kind === "paid");
  assert.equal(long.usd / short.usd, 15);
});

// Same rule as batchCost: a channel that cannot make the request must not be
// quoted a price. Video is xAI-only, so every other channel is unsupported
// rather than free — "免费" would imply it could produce a video for nothing.
test("channels without a video endpoint are unsupported, not free", () => {
  for (const provider of PROVIDERS) {
    if (provider.id === "xai") continue;
    assert.deepEqual(videoCost(provider.id, "720p", 6), { kind: "unsupported" }, provider.id);
  }
});

// The rates live in batch-cost.ts and are quoted again in the model's own `rates`
// string. If one is edited without the other, the cost box and the dropdown
// disagree about what the same video costs.
test("the per-second rates match the ones quoted on the model", () => {
  const rates = VIDEO_MODELS.find((m) => m.id === "grok-imagine-video")?.rates ?? "";
  const at480 = videoCost("xai", "480p", 1);
  const at720 = videoCost("xai", "720p", 1);
  assert.ok(at480.kind === "paid" && at720.kind === "paid");
  assert.match(rates, new RegExp(`480p \\$${at480.perSecond.toFixed(2)}/s`));
  assert.match(rates, new RegExp(`720p \\$${at720.perSecond.toFixed(2)}/s`));
});

// The prices are no longer in `label`, and the reason they were moved out was that
// a long label clips in the 320px params rail. Putting them back would restore the
// bug silently, since the trigger clamps with CSS rather than failing.
test("model labels carry no prices", () => {
  for (const model of [...VIDEO_MODELS, ...IMAGE_MODELS]) {
    assert.doesNotMatch(model.label, /\$/, model.id);
  }
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
