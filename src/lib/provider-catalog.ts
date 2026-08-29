// Per-model capabilities for the image providers.
//
// Two things live here that used to be hardcoded wrong:
//
// 1. `maxEdge` — a model's hard ceiling on the long edge. Z-Image-Turbo tops out
//    at 1664, so a 2k request was being rejected by ModelScope outright.
// 2. `steps` / `guidance` — every provider was sending num_inference_steps: 9 and
//    guidance_scale: 0.0, which are Z-Image-Turbo's *Turbo* settings. Sent to
//    SDXL or FLUX.1-dev those produce a blurry, under-denoised image.
//
// ponytail: the steps/guidance numbers are conventional defaults per model
// family (turbo/schnell = few steps + no guidance, standard = ~30 steps +
// guidance ~7), not measured optima. The shape is what matters; if a specific
// model looks off, tune its entry here rather than at the call site.

import { aspectToWH, type ProviderId, type ResolutionTier } from "./settings.ts";

export type ModelSpec = {
  id: string;
  label: string;
  /** Hard ceiling on the long edge, in pixels. Omitted = no known limit. */
  maxEdge?: number;
  /** Denoising steps. Omitted = let the provider decide. */
  steps?: number;
  /** CFG scale. 0 means "no guidance", which is correct for turbo models. */
  guidance?: number;
};

const TURBO = { steps: 9, guidance: 0 } as const;
const SCHNELL = { steps: 4, guidance: 0 } as const;
const STANDARD = { steps: 30, guidance: 7 } as const;

// Model ids verified against ModelScope's own docs/notes. ModelScope's
// /v1/models endpoint only returns LLM and audio models — Z-Image-Turbo is not
// in it — so this list cannot be auto-refreshed and must stay hand-maintained.
const MODELSCOPE_MODELS: ModelSpec[] = [
  { id: "Tongyi-MAI/Z-Image-Turbo", label: "Z-Image-Turbo（快）", maxEdge: 1664, ...TURBO },
  { id: "Qwen/Qwen-Image-2512", label: "Qwen-Image-2512", maxEdge: 1536, ...STANDARD },
  { id: "krea/Krea-2-Turbo", label: "Krea-2-Turbo（快）", maxEdge: 1536, ...TURBO },
  { id: "MAILAND/majicflus_v1", label: "majicflus v1", maxEdge: 1536, ...STANDARD },
  { id: "ideogram-ai/ideogram-4-fp8", label: "Ideogram 4", maxEdge: 1536, ...STANDARD },
  {
    id: "black-forest-labs/FLUX.1-schnell",
    label: "FLUX.1-schnell（快）",
    maxEdge: 1536,
    ...SCHNELL,
  },
  {
    id: "stabilityai/stable-diffusion-xl-base-1.0",
    label: "SDXL 1.0",
    maxEdge: 1024,
    steps: 30,
    guidance: 7.5,
  },
];

// Ids taken from a live read of https://ai.gitee.com/v1/models, filtered to the
// image-generating ones. Gitee caps every image at 2048 per edge.
const GITEE_MODELS: ModelSpec[] = [
  { id: "z-image-turbo", label: "Z-Image-Turbo（快·默认）", maxEdge: 2048, ...TURBO },
  { id: "Z-Image", label: "Z-Image", maxEdge: 2048, ...STANDARD },
  { id: "FLUX.2-dev", label: "FLUX.2-dev", maxEdge: 2048, ...STANDARD },
  { id: "Qwen-Image-2512", label: "Qwen-Image-2512", maxEdge: 2048, ...STANDARD },
  { id: "Qwen-Image", label: "Qwen-Image", maxEdge: 2048, ...STANDARD },
  { id: "Kolors", label: "Kolors", maxEdge: 2048, ...STANDARD },
  { id: "flux-1-schnell", label: "FLUX.1-schnell（快）", maxEdge: 2048, ...SCHNELL },
  {
    id: "stable-diffusion-3.5-large-turbo",
    label: "SD 3.5 Large Turbo（快）",
    maxEdge: 2048,
    ...TURBO,
  },
  {
    id: "stable-diffusion-xl-base-1.0",
    label: "SDXL 1.0",
    maxEdge: 1024,
    steps: 30,
    guidance: 7.5,
  },
];

// Pollinations only advertises one model anonymously (`/models` returns
// ["sana"]). The `model` query parameter is *ignored* without an API key — a
// nonsense name returns the same bytes as a real one — so names cannot be
// verified from here. `flux` is kept because it is the long-standing default and
// may resolve on a keyed account; anything else should come from the live fetch
// rather than being guessed here.
const POLLINATIONS_MODELS: ModelSpec[] = [
  { id: "flux", label: "flux（默认）" },
  { id: "sana", label: "sana" },
];

export const PROVIDER_MODEL_CATALOG: Partial<Record<ProviderId, ModelSpec[]>> = {
  modelscope: MODELSCOPE_MODELS,
  gitee: GITEE_MODELS,
  pollinations: POLLINATIONS_MODELS,
  // aihorde: intentionally empty — 163 community models, all fetchable at
  // runtime, and an empty choice correctly means "any available worker".
};

export function catalogModels(provider: ProviderId): ModelSpec[] {
  return PROVIDER_MODEL_CATALOG[provider] ?? [];
}

export function findModelSpec(provider: ProviderId, modelId: string): ModelSpec | undefined {
  return catalogModels(provider).find((model) => model.id === modelId);
}

/** Width/height for a provider+model, respecting that model's edge ceiling. */
export function resolveDimensions(
  provider: ProviderId,
  modelId: string,
  aspect: string,
  tier: ResolutionTier,
): { width: number; height: number } {
  return aspectToWH(aspect, tier, findModelSpec(provider, modelId)?.maxEdge);
}

/**
 * Sampler settings for a provider+model, as request-body fields. Returns an
 * empty object for unknown models so the provider applies its own defaults —
 * better than forcing one model family's numbers onto another.
 */
export function inferenceParams(provider: ProviderId, modelId: string): Record<string, number> {
  const spec = findModelSpec(provider, modelId);
  if (!spec) return {};
  const params: Record<string, number> = {};
  if (spec.steps !== undefined) params.num_inference_steps = spec.steps;
  if (spec.guidance !== undefined) params.guidance_scale = spec.guidance;
  return params;
}
