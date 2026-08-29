import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultSettings,
  loadSettings,
  providerSetupIssue,
  PROVIDERS,
  PROVIDER_FEATURES,
} from "./settings.ts";

test("catalogs every configured image provider", () => {
  assert.deepEqual(
    PROVIDERS.map((provider) => provider.id),
    ["xai", "modelscope", "aihorde", "pollinations", "pixai", "pixai-web", "pixai-pool"],
  );
});

test("describes PixAI official API key availability", () => {
  const pixai = PROVIDERS.find((provider) => provider.id === "pixai");

  assert.ok(pixai);
  assert.match(pixai.desc, /需申请/);
  assert.match(pixai.desc, /免费额度未知/);
});

test("describes PixAI web token as an experimental text-to-image provider", () => {
  const pixaiWeb = PROVIDERS.find((provider) => provider.id === "pixai-web");

  assert.ok(pixaiWeb);
  assert.equal(pixaiWeb.label, "PixAI 网页 Token（实验性）");
  assert.match(pixaiWeb.desc, /自备网页登录 Token/);
  assert.match(pixaiWeb.desc, /协议可能变化/);
  assert.match(pixaiWeb.desc, /仅文生图/);
});

test("defines persisted defaults for the new provider credentials", () => {
  assert.equal(defaultSettings.aiHordeApiKey, "");
  assert.equal(defaultSettings.pollinationsApiKey, "");
  assert.equal(defaultSettings.pollinationsModel, "flux");
  assert.equal(defaultSettings.pixaiApiKey, "");
  assert.equal(defaultSettings.pixaiModelVersionId, "1983308862240288769");
  assert.equal(defaultSettings.pixaiWebToken, "");
  assert.equal(defaultSettings.pixaiWebModelId, "");
  assert.equal(defaultSettings.pixaiPoolBaseUrl, "https://imgapi.qianyimwl.top");
});

test("falls back to xAI when a removed provider was saved", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        return JSON.stringify({ provider: "hf", hfToken: "legacy-token", concurrency: 2 });
      },
    },
  });

  try {
    const settings = loadSettings();
    // "hf" was removed from PROVIDER_FEATURES, so loadSettings must not keep it selected.
    assert.equal(settings.provider, "xai");
    assert.equal(settings.concurrency, 2);
    assert.equal(settings.pixaiWebToken, "");
    assert.equal(settings.pixaiWebModelId, "");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
});

test("declares only working new transports as text-to-image capable", () => {
  assert.deepEqual(PROVIDER_FEATURES.aihorde, { t2i: true, i2i: false, video: false });
  assert.deepEqual(PROVIDER_FEATURES.pollinations, { t2i: true, i2i: false, video: false });
  assert.deepEqual(PROVIDER_FEATURES.pixai, { t2i: true, i2i: false, video: false });
  assert.deepEqual(PROVIDER_FEATURES["pixai-web"], {
    t2i: true,
    i2i: false,
    video: false,
  });
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
  assert.equal(providerSetupIssue({ ...defaultSettings, provider: "pixai" }), "PixAI API Key");
  assert.equal(
    providerSetupIssue({ ...defaultSettings, provider: "pixai", pixaiApiKey: "   " }),
    "PixAI API Key",
  );
  assert.equal(
    providerSetupIssue({ ...defaultSettings, provider: "pixai", pixaiApiKey: "pixai-key" }),
    null,
  );
  assert.equal(
    providerSetupIssue({ ...defaultSettings, provider: "pixai-web" }),
    "PixAI 网页 Token",
  );
  assert.equal(
    providerSetupIssue({
      ...defaultSettings,
      provider: "pixai-web",
      pixaiWebToken: "   ",
      pixaiWebModelId: "web-model",
    }),
    "PixAI 网页 Token",
  );
  assert.equal(
    providerSetupIssue({
      ...defaultSettings,
      provider: "pixai-web",
      pixaiWebToken: "web-token",
    }),
    "PixAI 网页模型 ID",
  );
  assert.equal(
    providerSetupIssue({
      ...defaultSettings,
      provider: "pixai-web",
      pixaiWebToken: "web-token",
      pixaiWebModelId: "   ",
    }),
    "PixAI 网页模型 ID",
  );
  assert.equal(
    providerSetupIssue({
      ...defaultSettings,
      provider: "pixai-web",
      pixaiWebToken: "web-token",
      pixaiWebModelId: "web-model",
    }),
    null,
  );
});
