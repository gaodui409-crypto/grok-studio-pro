export type Settings = {
  apiKey: string;
  baseUrl: string;
  defaultResolution: "1k" | "2k";
  defaultAspectRatio: string;
};

const KEY = "grok-studio-settings";

export const defaultSettings: Settings = {
  apiKey: "",
  baseUrl: "https://api.x.ai",
  defaultResolution: "1k",
  defaultAspectRatio: "1:1",
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
