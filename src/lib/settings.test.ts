import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, providerSetupIssue, PROVIDERS, PROVIDER_FEATURES } from "./settings.ts";

test("catalogs every configured image provider", () => {
  assert.deepEqual(
    PROVIDERS.map((provider) => provider.id),
    ["xai", "modelscope", "hf", "aihorde", "pollinations", "pixai-pool"],
  );
});

test("defines persisted defaults for the new provider credentials", () => {
  assert.equal(defaultSettings.aiHordeApiKey, "");
  assert.equal(defaultSettings.pollinationsApiKey, "");
  assert.equal(defaultSettings.pollinationsModel, "flux");
  assert.equal(defaultSettings.pixaiPoolBaseUrl, "https://imgapi.qianyimwl.top");
});

test("declares only working new transports as text-to-image capable", () => {
  assert.deepEqual(PROVIDER_FEATURES.aihorde, { t2i: true, i2i: false, video: false });
  assert.deepEqual(PROVIDER_FEATURES.pollinations, { t2i: true, i2i: false, video: false });
  assert.deepEqual(PROVIDER_FEATURES["pixai-pool"], {
    t2i: false,
    i2i: false,
    video: false,
  });
});

test("reports setup blockers without requiring an AI Horde key", () => {
  assert.equal(providerSetupIssue({ ...defaultSettings, provider: "aihorde" }), null);
  assert.equal(
    providerSetupIssue({ ...defaultSettings, provider: "pollinations" }),
    "Pollinations API Key",
  );
  assert.equal(
    providerSetupIssue({
      ...defaultSettings,
      provider: "pollinations",
      pollinationsApiKey: "   ",
    }),
    "Pollinations API Key",
  );
  assert.equal(
    providerSetupIssue({ ...defaultSettings, provider: "pixai-pool" }),
    "PixAI 号池请求协议（HAR / Network）",
  );
});
