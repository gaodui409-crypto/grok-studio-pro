import type { Settings } from "./settings.ts";

export function getSettingsDefaultPatches(settings: Settings) {
  return {
    t2i: {
      aspect: settings.defaultAspectRatio,
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    i2i: {
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    video: {
      model: settings.videoModel,
    },
    fanart: {
      aspect: settings.defaultAspectRatio,
      resolution: settings.defaultResolution,
      model: settings.imageModel,
    },
    comic: { model: settings.imageModel },
  } as const;
}
