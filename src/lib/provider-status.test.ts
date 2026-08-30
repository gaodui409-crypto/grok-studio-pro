import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, type Settings } from "./settings.ts";
import { providerStatus, splitProviderLabel } from "./provider-status.ts";

function settings(patch: Partial<Settings>): Settings {
  return { ...defaultSettings, ...patch };
}

test("未填凭证的渠道是 unset", () => {
  assert.equal(providerStatus(settings({}), "gitee"), "unset");
  assert.equal(providerStatus(settings({}), "xai"), "unset");
});

test("填好凭证的渠道是 ready", () => {
  assert.equal(providerStatus(settings({ giteeApiKey: "k" }), "gitee"), "ready");
});

test("匿名 AI Horde 是 limited，填了 Key 才是 ready", () => {
  // providerSetupIssue() calls anonymous Horde "ready" because it needs no
  // credentials, but 0 Kudos caps it around 711px — the nav has to show that
  // difference, otherwise it looks identical to a fully configured channel.
  assert.equal(providerStatus(settings({}), "aihorde"), "limited");
  assert.equal(providerStatus(settings({ aiHordeApiKey: "k" }), "aihorde"), "ready");
});

test("PixAI 号池永远是 unset：协议未接入，填什么都不能生成", () => {
  assert.equal(providerStatus(settings({ pixaiPoolBaseUrl: "https://x" }), "pixai-pool"), "unset");
});

test("PixAI 网页需要 Token 和模型 ID 两者齐全", () => {
  assert.equal(providerStatus(settings({ pixaiWebToken: "t" }), "pixai-web"), "unset");
  assert.equal(
    providerStatus(settings({ pixaiWebToken: "t", pixaiWebModelId: "m" }), "pixai-web"),
    "ready",
  );
});

test("splitProviderLabel 拆出括号里的限定语", () => {
  assert.deepEqual(splitProviderLabel("Gitee AI 模力方舟（免费）"), {
    name: "Gitee AI 模力方舟",
    tag: "免费",
  });
  assert.deepEqual(splitProviderLabel("AI Horde（社区算力）"), {
    name: "AI Horde",
    tag: "社区算力",
  });
});

test("splitProviderLabel 对没有括号的标签原样返回", () => {
  assert.deepEqual(splitProviderLabel("Pollinations"), { name: "Pollinations", tag: null });
  // Not a suffix, so it stays part of the name — "xAI / NewAPI 中转" has no
  // qualifier to peel off.
  assert.deepEqual(splitProviderLabel("xAI / NewAPI 中转"), {
    name: "xAI / NewAPI 中转",
    tag: null,
  });
});
