export const IMAGE_MODELS = [
  { id: "grok-imagine-image-pro", label: "Grok Imagine · Image Pro ($0.07/张)" },
  { id: "grok-imagine-image", label: "Grok Imagine · Image ($0.04/张)" },
] as const;

export const VIDEO_MODELS = [
  { id: "grok-imagine-video", label: "Grok Imagine · Video (480p $0.05/s · 720p $0.07/s)" },
] as const;

export type Settings = {
  apiKey: string;
  baseUrl: string;
  defaultResolution: "1k" | "2k";
  defaultAspectRatio: string;
  imageModel: string;
  videoModel: string;
};

const KEY = "grok-studio-settings";

export const defaultSettings: Settings = {
  apiKey: "",
  baseUrl: "https://api.x.ai",
  defaultResolution: "1k",
  defaultAspectRatio: "1:1",
  imageModel: "grok-imagine-image",
  videoModel: "grok-imagine-video",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("grok-settings-changed"));
}
