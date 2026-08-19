export const IMAGE_MODELS = [
  { id: "grok-imagine-image-pro", label: "Grok Imagine · Image Pro ($0.07/张)" },
  { id: "grok-imagine-image", label: "Grok Imagine · Image ($0.04/张)" },
] as const;

export const VIDEO_MODELS = [
  { id: "grok-imagine-video", label: "Grok Imagine · Video (480p $0.05/s · 720p $0.07/s)" },
] as const;

export type ProviderId =
  | "xai"
  | "modelscope"
  | "hf"
  | "aihorde"
  | "pollinations"
  | "pixai"
  | "pixai-pool";

export const PROVIDERS: { id: ProviderId; label: string; desc: string }[] = [
  {
    id: "xai",
    label: "xAI / NewAPI 中转",
    desc: "支持文生图、图生图、视频。可用于官方 api.x.ai 或兼容的 NewAPI 中转。",
  },
  {
    id: "modelscope",
    label: "魔搭 ModelScope（免费）",
    desc: "Tongyi-MAI/Z-Image-Turbo，2000/天，仅文生图。",
  },
  { id: "hf", label: "Hugging Face", desc: "HF Inference API，免费用户约 80 次/天，仅文生图。" },
  {
    id: "aihorde",
    label: "AI Horde（社区算力）",
    desc: "可匿名使用，但匿名任务排队优先级最低，仅文生图。",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    desc: "使用 API Key / Pollen 额度，直接返回图片，仅文生图。",
  },
  {
    id: "pixai",
    label: "PixAI 官方 API",
    desc: "使用 PixAI v2 API Key 和模型版本 ID，异步生成图片，仅文生图。",
  },
  {
    id: "pixai-pool",
    label: "PixAI 号池（待协议）",
    desc: "已登记 imgapi.qianyimwl.top；需提供真实 HAR / Network 请求后才能启用生成。",
  },
];

export const HF_MODEL_PRESETS = ["Tongyi-MAI/Z-Image-Turbo", "black-forest-labs/FLUX.1-Krea-dev"];

export const PROVIDER_FEATURES: Record<ProviderId, { t2i: boolean; i2i: boolean; video: boolean }> =
  {
    xai: { t2i: true, i2i: true, video: true },
    modelscope: { t2i: true, i2i: false, video: false },
    hf: { t2i: true, i2i: false, video: false },
    aihorde: { t2i: true, i2i: false, video: false },
    pollinations: { t2i: true, i2i: false, video: false },
    pixai: { t2i: true, i2i: false, video: false },
    "pixai-pool": { t2i: false, i2i: false, video: false },
  };

export const PIXAI_MODEL_PRESETS = [
  { id: "1983308862240288769", label: "Tsubaki.2" },
  { id: "1861558740588989558", label: "Haruka v2" },
  { id: "1954632828118619567", label: "Hoshino v2" },
] as const;

export const PIXAI_DEFAULT_MODEL_VERSION_ID = PIXAI_MODEL_PRESETS[0].id;

export type Settings = {
  // Provider selection
  provider: ProviderId;
  // xAI / NewAPI
  apiKey: string;
  baseUrl: string;
  imageModel: string;
  videoModel: string;
  // ModelScope
  modelscopeToken: string;
  // Hugging Face
  hfToken: string;
  hfModel: string;
  // AI Horde
  aiHordeApiKey: string;
  // Pollinations
  pollinationsApiKey: string;
  pollinationsModel: string;
  // PixAI official API
  pixaiApiKey: string;
  pixaiModelVersionId: string;
  // PixAI account pool
  pixaiPoolBaseUrl: string;
  // Shared defaults
  defaultResolution: "1k" | "2k";
  defaultAspectRatio: string;
  concurrency: number;
};

const KEY = "grok-studio-settings";

export const defaultSettings: Settings = {
  provider: "xai",
  apiKey: "",
  baseUrl: "https://api.x.ai",
  imageModel: "grok-imagine-image-pro",
  videoModel: "grok-imagine-video",
  modelscopeToken: "",
  hfToken: "",
  hfModel: "Tongyi-MAI/Z-Image-Turbo",
  aiHordeApiKey: "",
  pollinationsApiKey: "",
  pollinationsModel: "flux",
  pixaiApiKey: "",
  pixaiModelVersionId: PIXAI_DEFAULT_MODEL_VERSION_ID,
  pixaiPoolBaseUrl: "https://imgapi.qianyimwl.top",
  defaultResolution: "1k",
  defaultAspectRatio: "1:1",
  concurrency: 3,
};

export function providerSetupIssue(settings: Settings): string | null {
  if (settings.provider === "xai") {
    return settings.apiKey ? null : "xAI / NewAPI API Key";
  }
  if (settings.provider === "modelscope") {
    return settings.modelscopeToken ? null : "ModelScope Token";
  }
  if (settings.provider === "hf") {
    return settings.hfToken ? null : "Hugging Face Token";
  }
  if (settings.provider === "pollinations") {
    return settings.pollinationsApiKey.trim() ? null : "Pollinations API Key";
  }
  if (settings.provider === "pixai") {
    return settings.pixaiApiKey.trim() ? null : "PixAI API Key";
  }
  if (settings.provider === "pixai-pool") {
    return "PixAI 号池请求协议（HAR / Network）";
  }
  return null;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const merged = { ...defaultSettings, ...JSON.parse(raw) };
    merged.concurrency = Math.max(1, Math.min(10, Number(merged.concurrency) || 3));
    if (!PROVIDER_FEATURES[merged.provider as ProviderId]) merged.provider = "xai";
    return merged;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("grok-settings-changed"));
}

// Map an aspect ratio + resolution tier to width/height for non-xAI providers.
export function aspectToWH(
  aspect: string,
  resolution: "1k" | "2k" = "1k",
): { width: number; height: number } {
  const base = resolution === "2k" ? 2048 : 1024;
  const m = /^(\d+):(\d+)$/.exec(aspect);
  if (!m) return { width: base, height: base };
  const w = +m[1],
    h = +m[2];
  if (w >= h) {
    const width = base;
    const height = Math.round((base * h) / w / 8) * 8;
    return { width, height };
  } else {
    const height = base;
    const width = Math.round((base * w) / h / 8) * 8;
    return { width, height };
  }
}
