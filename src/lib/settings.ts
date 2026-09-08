// `rates` is deliberately not folded into `label`. A select trigger is a
// fixed-width control showing the *current value*, so anything inside the label
// competes for that space with the name of the thing being identified — the video
// model has two rates and rendered as
// "Grok Imagine · Video (480p $0.05/s ·" in the 320px params rail, clipped
// mid-price. The name identifies, the rates inform; they get shown in different
// places (see ParamSelect) and only the name has to survive the clamp.
export const IMAGE_MODELS = [
  { id: "grok-imagine-image-pro", label: "Grok Imagine · Image Pro", rates: "$0.07/张" },
  { id: "grok-imagine-image", label: "Grok Imagine · Image", rates: "$0.04/张" },
] as const;

export const VIDEO_MODELS = [
  {
    id: "grok-imagine-video",
    label: "Grok Imagine · Video",
    rates: "480p $0.05/s · 720p $0.07/s",
  },
] as const;

export type ProviderId =
  | "xai"
  | "gitee"
  | "modelscope"
  | "aihorde"
  | "pollinations"
  | "pixai"
  | "pixai-web"
  | "pixai-pool";

// `quota` is the free-tier summary shown next to each provider in settings.
// Numbers come from the 0829 hands-on notes, not from any API — treat them as
// "what the vendor advertised then", and re-check before trusting a big batch.
export const PROVIDERS: { id: ProviderId; label: string; desc: string; quota: string }[] = [
  {
    id: "xai",
    label: "xAI / NewAPI 中转",
    desc: "支持文生图、图生图、视频。可用于官方 api.x.ai 或兼容的 NewAPI 中转。",
    quota: "按量付费，无免费额度。Image Pro $0.07/张、Image $0.04/张，$1 约 14 / 25 张。",
  },
  {
    id: "gitee",
    label: "Gitee AI 模力方舟（免费）",
    desc: "每日 100 次免费额度，OpenAI 兼容接口，浏览器可直连，仅文生图。",
    quota: "每日 100 张，次日刷新。实测无内容审查。注册需绑定 +86 手机号。",
  },
  {
    id: "modelscope",
    label: "魔搭 ModelScope（免费）",
    desc: "多个文生图模型，2000/天，仅文生图。",
    quota: "每日总调用 2000 次，但单个文生图模型约 50 张/天。可能需手机号 + 支付宝实名。",
  },
  {
    id: "aihorde",
    label: "AI Horde（社区算力）",
    desc: "可匿名使用，但匿名任务排队优先级最低，仅文生图。",
    quota:
      "免费但按 Kudos 计费，新号 Kudos 为 0：只能出低分辨率（约 711×711 以下），高分辨率会被拒。",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    desc: "使用 API Key / Pollen 额度，直接返回图片，仅文生图。",
    quota: "注册送 0.15 + 任务 0.5 = 0.65 Pollen，不再每日刷新。按常用模型约 160 张。",
  },
  {
    id: "pixai",
    label: "PixAI 官方 API",
    desc: "使用 PixAI v2 API Key 和模型版本 ID；普通用户需申请并等待审核，会员可直接获取，公开免费额度未知。仅文生图。",
    quota: "免费额度未知：普通用户需申请并等待审核，会员可直接获取 Key。",
  },
  {
    id: "pixai-web",
    label: "PixAI 网页 Token（实验性）",
    desc: "自备网页登录 Token 和网页模型 ID；协议可能变化，仅文生图。",
    quota: "新号约 25000 积分，每日登录可领 10000。Token 有效期约一周，过期需重新复制。",
  },
  {
    id: "pixai-pool",
    label: "PixAI 号池（待协议）",
    desc: "已登记 imgapi.qianyimwl.top；需提供真实 HAR / Network 请求后才能启用生成。",
    quota: "未接入，无额度信息。",
  },
];

export const PROVIDER_FEATURES: Record<ProviderId, { t2i: boolean; i2i: boolean; video: boolean }> =
  {
    xai: { t2i: true, i2i: true, video: true },
    gitee: { t2i: true, i2i: false, video: false },
    modelscope: { t2i: true, i2i: false, video: false },
    aihorde: { t2i: true, i2i: false, video: false },
    pollinations: { t2i: true, i2i: false, video: false },
    pixai: { t2i: true, i2i: false, video: false },
    "pixai-web": { t2i: true, i2i: false, video: false },
    "pixai-pool": { t2i: false, i2i: false, video: false },
  };

export const PIXAI_MODEL_PRESETS = [
  { id: "1983308862240288769", label: "Tsubaki.2" },
  { id: "1861558740588989558", label: "Haruka v2" },
  { id: "1954632828118619567", label: "Hoshino v2" },
] as const;

export const PIXAI_DEFAULT_MODEL_VERSION_ID = PIXAI_MODEL_PRESETS[0].id;

// The 0829 notes report Haruka v2's web modelId as the same digits as its
// official modelVersionId. That contradicts the long-standing assumption that
// the two ID spaces never overlap, and only one of the two can be right — so
// this is offered as a starting guess, not a verified preset. If generation
// fails with it, read the real modelId from the web app's createGenerationTask
// request body. Keep this list separate from PIXAI_MODEL_PRESETS so that a
// wrong guess here can never leak into the official-API channel.
export const PIXAI_WEB_MODEL_PRESETS = [
  { id: "1861558740588989558", label: "Haruka v2（待验证）" },
];

// Resolution tiers, shared by every provider. Small tiers exist because some
// free channels reject large images outright (AI Horde with zero Kudos caps out
// around 711px), so "1k minimum" would make those channels unusable.
export type ResolutionTier = "512" | "768" | "1k" | "1.5k" | "2k";

export const RESOLUTION_TIERS: { id: ResolutionTier; edge: number; label: string }[] = [
  { id: "512", edge: 512, label: "512 · 省额度" },
  { id: "768", edge: 768, label: "768" },
  { id: "1k", edge: 1024, label: "1k" },
  { id: "1.5k", edge: 1536, label: "1.5k" },
  { id: "2k", edge: 2048, label: "2k" },
];

const TIER_EDGES: Record<ResolutionTier, number> = {
  "512": 512,
  "768": 768,
  "1k": 1024,
  "1.5k": 1536,
  "2k": 2048,
};

export function tierEdge(tier: ResolutionTier): number {
  return TIER_EDGES[tier] ?? 1024;
}

// Narrow an arbitrary tier down to the closest tier a provider actually accepts.
// Used by xAI (only 1k/2k) and PixAI (only 1k/1.5k), which take a tier *name*
// rather than pixel dimensions — passing "512" straight through would be
// rejected by the API.
//
// Exact ties round *up* (1.5k is equidistant from 1k and 2k): the user asked for
// the higher tier, so quietly handing back the lower one loses resolution they
// explicitly selected.
export function nearestTier(
  tier: ResolutionTier,
  allowed: readonly ResolutionTier[],
): ResolutionTier {
  if (allowed.includes(tier)) return tier;
  const target = tierEdge(tier);
  let best = allowed[0];
  for (const candidate of allowed) {
    const gap = Math.abs(tierEdge(candidate) - target);
    const bestGap = Math.abs(tierEdge(best) - target);
    if (gap < bestGap || (gap === bestGap && tierEdge(candidate) > tierEdge(best))) {
      best = candidate;
    }
  }
  return best;
}

export type Settings = {
  // Provider selection
  provider: ProviderId;
  // Automatic quota fallback may use xAI only when explicitly enabled.
  allowPaidFallback: boolean;
  // Per-channel daily cap, used by the local quota tally (see lib/quota.ts).
  // Absent or 0 means "no cap set" = unlimited as far as this app is concerned.
  dailyLimits: Partial<Record<ProviderId, number>>;
  // xAI / NewAPI
  apiKey: string;
  baseUrl: string;
  imageModel: string;
  videoModel: string;
  // Gitee AI
  giteeApiKey: string;
  giteeModel: string;
  // ModelScope
  modelscopeToken: string;
  modelscopeModel: string;
  // AI Horde
  aiHordeApiKey: string;
  aiHordeModel: string;
  // Pollinations
  pollinationsApiKey: string;
  pollinationsModel: string;
  // PixAI official API
  pixaiApiKey: string;
  pixaiModelVersionId: string;
  // PixAI web GraphQL
  pixaiWebToken: string;
  pixaiWebModelId: string;
  // PixAI account pool
  pixaiPoolBaseUrl: string;
  // Shared defaults
  defaultResolution: ResolutionTier;
  defaultAspectRatio: string;
  concurrency: number;
};

// Which Settings field holds the chosen model for each provider. Lets the UI and
// the runtime say "the model for provider X" without a switch per call site.
// null = the provider has no model choice at all.
export const PROVIDER_MODEL_FIELD: Record<ProviderId, keyof Settings | null> = {
  xai: "imageModel",
  gitee: "giteeModel",
  modelscope: "modelscopeModel",
  aihorde: "aiHordeModel",
  pollinations: "pollinationsModel",
  pixai: "pixaiModelVersionId",
  "pixai-web": "pixaiWebModelId",
  "pixai-pool": null,
};

const KEY = "grok-studio-settings";

export const defaultSettings: Settings = {
  provider: "xai",
  allowPaidFallback: false,
  // Only the two channels whose daily allowance the 0829 notes actually pin down
  // are pre-filled. The rest meter something that is not per-day at all
  // (Pollinations' non-refreshing Pollen, AI Horde Kudos, PixAI points) or are
  // pay-as-you-go (xAI), so inventing a daily number for them would invent a cap
  // the vendor does not have.
  dailyLimits: { gitee: 100, modelscope: 50 },
  apiKey: "",
  baseUrl: "https://api.x.ai",
  imageModel: "grok-imagine-image-pro",
  videoModel: "grok-imagine-video",
  giteeApiKey: "",
  giteeModel: "z-image-turbo",
  modelscopeToken: "",
  modelscopeModel: "Tongyi-MAI/Z-Image-Turbo",
  aiHordeApiKey: "",
  aiHordeModel: "",
  pollinationsApiKey: "",
  pollinationsModel: "flux",
  pixaiApiKey: "",
  pixaiModelVersionId: PIXAI_DEFAULT_MODEL_VERSION_ID,
  pixaiWebToken: "",
  pixaiWebModelId: "",
  pixaiPoolBaseUrl: "https://imgapi.qianyimwl.top",
  defaultResolution: "1k",
  defaultAspectRatio: "1:1",
  concurrency: 3,
};

// Returns the missing credential for `provider`, or null when it is ready to
// generate. Defaults to the currently selected provider; pass an explicit id to
// ask about any other one (the generation page uses this to list which channels
// are usable without making the user visit settings).
export function providerSetupIssue(
  settings: Settings,
  provider: ProviderId = settings.provider,
): string | null {
  if (provider === "xai") {
    return settings.apiKey ? null : "xAI / NewAPI API Key";
  }
  if (provider === "gitee") {
    return settings.giteeApiKey.trim() ? null : "Gitee AI API Key";
  }
  if (provider === "modelscope") {
    return settings.modelscopeToken ? null : "ModelScope Token";
  }
  if (provider === "pollinations") {
    return settings.pollinationsApiKey.trim() ? null : "Pollinations API Key";
  }
  if (provider === "pixai") {
    return settings.pixaiApiKey.trim() ? null : "PixAI API Key";
  }
  if (provider === "pixai-web") {
    if (!settings.pixaiWebToken.trim()) return "PixAI 网页 Token";
    return settings.pixaiWebModelId.trim() ? null : "PixAI 网页模型 ID";
  }
  if (provider === "pixai-pool") {
    return "PixAI 号池请求协议（HAR / Network）";
  }
  return null;
}

// Providers that are ready to generate right now, in PROVIDERS order.
export function enabledProviders(settings: Settings): ProviderId[] {
  return PROVIDERS.filter(
    (provider) =>
      PROVIDER_FEATURES[provider.id].t2i && providerSetupIssue(settings, provider.id) === null,
  ).map((provider) => provider.id);
}

// Channels the automatic quota fallback is allowed to redirect to.
//
// Narrower than enabledProviders() on purpose. AI Horde needs no credentials, so
// providerSetupIssue() says it is "ready" and it would otherwise be the first
// fallback for everyone — but an anonymous Horde account has 0 Kudos, meaning
// lowest queue priority and a hard ceiling around 711px. Being silently moved
// there means a long wait for an image at a resolution the user did not ask for.
// Picking it by hand is fine; being sent there behind your back is not.
export function fallbackProviders(settings: Settings): ProviderId[] {
  return enabledProviders(settings).filter(
    (id) =>
      (id !== "aihorde" || settings.aiHordeApiKey.trim() !== "") &&
      (id !== "xai" || settings.allowPaidFallback),
  );
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const merged = { ...defaultSettings, ...JSON.parse(raw) };
    merged.concurrency = Math.max(1, Math.min(10, Number(merged.concurrency) || 3));
    if (!PROVIDER_FEATURES[merged.provider as ProviderId]) merged.provider = "xai";
    // A tier written by a future/older build (or hand-edited) must not reach the
    // providers as an unknown string — they'd derive NaN dimensions from it.
    if (!TIER_EDGES[merged.defaultResolution as ResolutionTier]) {
      merged.defaultResolution = defaultSettings.defaultResolution;
    }
    // A hand-edited or older payload can hold junk here; the quota code does
    // arithmetic on these, so a string would produce NaN limits and make every
    // channel look exhausted.
    if (!merged.dailyLimits || typeof merged.dailyLimits !== "object") {
      merged.dailyLimits = { ...defaultSettings.dailyLimits };
    } else {
      const clean: Partial<Record<ProviderId, number>> = {};
      for (const [id, value] of Object.entries(merged.dailyLimits)) {
        const n = Number(value);
        if (PROVIDER_FEATURES[id as ProviderId] && Number.isFinite(n) && n > 0) {
          clean[id as ProviderId] = Math.floor(n);
        }
      }
      merged.dailyLimits = clean;
    }
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
// `maxEdge` caps the long edge for models with a hard ceiling (Z-Image-Turbo
// tops out at 1664, so a 2k request would be rejected outright). Clamping the
// long edge before deriving the short edge keeps the aspect ratio intact.
export function aspectToWH(
  aspect: string,
  resolution: ResolutionTier = "1k",
  maxEdge?: number,
): { width: number; height: number } {
  const base = Math.min(tierEdge(resolution), maxEdge ?? Number.POSITIVE_INFINITY);
  const m = /^(\d+):(\d+)$/.exec(aspect);
  if (!m) return { width: base, height: base };
  const w = +m[1],
    h = +m[2];
  const shortEdge = Math.max(8, Math.round((base * Math.min(w, h)) / Math.max(w, h) / 8) * 8);
  return w >= h ? { width: base, height: shortEdge } : { width: shortEdge, height: base };
}
