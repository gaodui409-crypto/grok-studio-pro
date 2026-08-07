import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "./settings.ts";
import { getSettingsDefaultPatches } from "./settings-defaults.ts";

test("maps image defaults only to image workflows", () => {
  const settings = {
    ...defaultSettings,
    imageModel: "custom-image",
    videoModel: "custom-video",
    defaultAspectRatio: "16:9",
    defaultResolution: "2k" as const,
  };

  assert.deepEqual(getSettingsDefaultPatches(settings), {
    t2i: { aspect: "16:9", resolution: "2k", model: "custom-image" },
    i2i: { resolution: "2k", model: "custom-image" },
    video: { model: "custom-video" },
    fanart: { aspect: "16:9", resolution: "2k", model: "custom-image" },
    comic: { model: "custom-image" },
  });
});

test("does not map image resolution into video resolution", () => {
  const patches = getSettingsDefaultPatches({
    ...defaultSettings,
    defaultResolution: "2k",
  });
  assert.deepEqual(Object.keys(patches.video), ["model"]);
});
