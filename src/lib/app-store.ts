// Global, in-memory store for per-page state.
// Persists across route navigation (since the store lives outside the component tree)
// so that switching tabs and coming back keeps inputs, progress and results intact.
//
// Page state is intentionally kept in plain JS — there is no localStorage middleware
// here because (a) data URIs and big result lists shouldn't bloat localStorage, and
// (b) the user expects state to survive within a session, not across browser restarts.

import { create } from "zustand";
import type { GeneratedImage, VideoStatus } from "./xai";
import type { CharacterPreset } from "./character-presets";

// ---------------- Text-to-image (/) ----------------
export type T2IState = {
  prompt: string;
  n: number;
  aspect: string;
  resolution: "1k" | "2k";
  model: string;
  loading: boolean;
  images: GeneratedImage[];
};

// ---------------- Image-to-image (/edit) ----------------
export type I2IState = {
  images: string[];
  prompt: string;
  n: number;
  resolution: "1k" | "2k";
  model: string;
  loading: boolean;
  results: GeneratedImage[];
};

// ---------------- Video (/video) ----------------
export type VideoSubMode = "t2v" | "i2v" | "edit" | "extend";
export type VideoState = {
  subMode: VideoSubMode;
  prompt: string;
  duration: number;
  extendDuration: number;
  aspect: string;
  resolution: "480p" | "720p";
  model: string;
  startImage: string[];
  refImages: string[];
  sourceVideoUrl: string;
  // File can't survive store updates well — persist as data URI string instead
  sourceVideoDataUri: string;
  sourceVideoName: string;
  loading: boolean;
  status: VideoStatus | null;
  videoUrl: string | null;
};

// ---------------- Fanart (/fanart) ----------------
export type SceneSel = {
  outfits: Record<string, boolean>;
  actions: Record<string, boolean>;
  enabled: boolean;
};
export type FanartState = {
  presetId: string; // "" = custom
  charName: string;
  charDesc: string;
  refImages: string[];
  sel: Record<string, SceneSel>;
  styleSel: string;
  lightSel: string;
  mode: "single" | "multi";
  activeSceneId: string;
  aspect: string;
  resolution: "1k" | "2k";
  model: string;
  overrides: Record<string, string>;
  running: boolean;
  done: number;
  total: number;
  currentPrompt: string;
  lastPresetApplied: string;
};

// ---------------- Comic (/comic) ----------------
export type ComicPageItem = {
  id: string;
  name: string;
  src: string;
  resultUrl?: string;
  status: "pending" | "running" | "done" | "failed";
  step?: string;
  translation?: string;
  error?: string;
};
export type ComicState = {
  tab: "colorize" | "translate";
  model: string;
  // colorize
  colorPages: ComicPageItem[];
  styleSel: string;
  customStyle: string;
  refImage: string[];
  colorRunning: boolean;
  colorDone: number;
  // translate
  translatePages: ComicPageItem[];
  preset: string;
  customFrom: string;
  customTo: string;
  translateRunning: boolean;
  translateDone: number;
};

type Store = {
  t2i: T2IState;
  i2i: I2IState;
  video: VideoState;
  fanart: FanartState;
  comic: ComicState;
  setT2I: (patch: Partial<T2IState>) => void;
  setI2I: (patch: Partial<I2IState>) => void;
  setVideo: (patch: Partial<VideoState>) => void;
  setFanart: (patch: Partial<FanartState>) => void;
  setComic: (patch: Partial<ComicState>) => void;
  patchFanart: (fn: (s: FanartState) => FanartState) => void;
  patchComic: (fn: (s: ComicState) => ComicState) => void;
};

export const initialT2I: T2IState = {
  prompt: "",
  n: 1,
  aspect: "1:1",
  resolution: "1k",
  model: "grok-imagine-image-pro",
  loading: false,
  images: [],
};
export const initialI2I: I2IState = {
  images: [],
  prompt: "",
  n: 1,
  resolution: "1k",
  model: "grok-imagine-image-pro",
  loading: false,
  results: [],
};
export const initialVideo: VideoState = {
  subMode: "t2v",
  prompt: "",
  duration: 6,
  extendDuration: 6,
  aspect: "16:9",
  resolution: "480p",
  model: "grok-imagine-video",
  startImage: [],
  refImages: [],
  sourceVideoUrl: "",
  sourceVideoDataUri: "",
  sourceVideoName: "",
  loading: false,
  status: null,
  videoUrl: null,
};
export const initialFanart: FanartState = {
  presetId: "",
  charName: "",
  charDesc: "",
  refImages: [],
  sel: {},
  styleSel: "",
  lightSel: "",
  mode: "single",
  activeSceneId: "",
  aspect: "1:1",
  resolution: "1k",
  model: "grok-imagine-image-pro",
  overrides: {},
  running: false,
  done: 0,
  total: 0,
  currentPrompt: "",
  lastPresetApplied: "",
};
export const initialComic: ComicState = {
  tab: "colorize",
  model: "grok-imagine-image-pro",
  colorPages: [],
  styleSel: "日系动漫上色",
  customStyle: "",
  refImage: [],
  colorRunning: false,
  colorDone: 0,
  translatePages: [],
  preset: "0",
  customFrom: "",
  customTo: "",
  translateRunning: false,
  translateDone: 0,
};

export const useAppStore = create<Store>((set) => ({
  t2i: initialT2I,
  i2i: initialI2I,
  video: initialVideo,
  fanart: initialFanart,
  comic: initialComic,
  setT2I: (patch) => set((s) => ({ t2i: { ...s.t2i, ...patch } })),
  setI2I: (patch) => set((s) => ({ i2i: { ...s.i2i, ...patch } })),
  setVideo: (patch) => set((s) => ({ video: { ...s.video, ...patch } })),
  setFanart: (patch) => set((s) => ({ fanart: { ...s.fanart, ...patch } })),
  setComic: (patch) => set((s) => ({ comic: { ...s.comic, ...patch } })),
  patchFanart: (fn) => set((s) => ({ fanart: fn(s.fanart) })),
  patchComic: (fn) => set((s) => ({ comic: fn(s.comic) })),
}));

// Apply a character preset to the fanart state — exported here so the settings
// page (preset manager) and the fanart page share one implementation.
export function applyPresetToFanart(
  preset: CharacterPreset,
  scenes: { id: string; name: string; outfits: string[]; actions: string[] }[],
  patch: (fn: (s: FanartState) => FanartState) => void,
) {
  patch((s) => {
    const sel: Record<string, SceneSel> = {};
    let firstActiveId = s.activeSceneId;
    for (const scene of scenes) {
      const matches = preset.scenes.filter((p) => scene.name.includes(p.sceneName));
      if (!matches.length) continue;
      const outfits: Record<string, boolean> = {};
      const actions: Record<string, boolean> = {};
      // Note: we DO NOT mutate the scene tree itself — we just check items
      // already present in the scene that match preset entries.
      for (const m of matches) {
        for (const o of m.outfits) {
          // Check by substring/equality — scene tree may use Chinese names
          if (scene.outfits.some((x) => x === o || x.includes(o) || o.includes(x))) {
            outfits[scene.outfits.find((x) => x === o || x.includes(o) || o.includes(x))!] = true;
          } else {
            // also auto-add if missing (so preset is meaningful out of the box)
            outfits[o] = true;
          }
        }
        for (const a of m.actions) {
          if (scene.actions.some((x) => x === a || x.includes(a) || a.includes(x))) {
            actions[scene.actions.find((x) => x === a || x.includes(a) || a.includes(x))!] = true;
          } else {
            actions[a] = true;
          }
        }
      }
      sel[scene.id] = { outfits, actions, enabled: true };
      if (!firstActiveId || !s.sel[firstActiveId]) firstActiveId = scene.id;
    }
    return {
      ...s,
      presetId: preset.id,
      charName: preset.name.split("·").pop()?.trim() || preset.name,
      charDesc: preset.description,
      sel,
      styleSel: preset.defaultStyle ?? "",
      lightSel: preset.defaultLighting ?? "",
      activeSceneId: firstActiveId || s.activeSceneId,
      lastPresetApplied: preset.id,
    };
  });
}

// Returns the new outfits/actions that the preset wants to add to the scene tree
// (so the scene tree can include them as new chips). The fanart page calls this
// after `applyPresetToFanart` so chips show up checked.
export function presetExtraItems(
  preset: CharacterPreset,
  scenes: { id: string; name: string; outfits: string[]; actions: string[] }[],
): { sceneId: string; addOutfits: string[]; addActions: string[] }[] {
  const out: { sceneId: string; addOutfits: string[]; addActions: string[] }[] = [];
  for (const scene of scenes) {
    const matches = preset.scenes.filter((p) => scene.name.includes(p.sceneName));
    if (!matches.length) continue;
    const addOutfits: string[] = [];
    const addActions: string[] = [];
    for (const m of matches) {
      for (const o of m.outfits) {
        if (!scene.outfits.some((x) => x === o || x.includes(o) || o.includes(x))) {
          addOutfits.push(o);
        }
      }
      for (const a of m.actions) {
        if (!scene.actions.some((x) => x === a || x.includes(a) || a.includes(x))) {
          addActions.push(a);
        }
      }
    }
    if (addOutfits.length || addActions.length) {
      out.push({ sceneId: scene.id, addOutfits, addActions });
    }
  }
  return out;
}
