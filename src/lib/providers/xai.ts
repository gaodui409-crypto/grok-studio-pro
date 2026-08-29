import { resolveImageModel } from "../provider-runtime.ts";
import { loadSettings, nearestTier, type ResolutionTier } from "../settings.ts";
import { xaiRequest } from "./xai-client.ts";
import type {
  GeneratedImage,
  ImageEditParams,
  ImageGenParams,
  ImageProviderAdapter,
} from "./types.ts";

type RawImage = {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
  mime_type?: string;
};

function normalizeImage(raw: RawImage): GeneratedImage {
  const mime = raw.mime_type || "image/png";
  if (raw.b64_json) {
    return {
      url: `data:${mime};base64,${raw.b64_json}`,
      revised_prompt: raw.revised_prompt,
      mime_type: mime,
    };
  }
  return {
    url: raw.url || "",
    revised_prompt: raw.revised_prompt,
    mime_type: mime,
  };
}

// The xAI image API takes a tier name, and only knows "1k" and "2k". The shared
// tier list is wider than that (small tiers exist for the free channels), so map
// onto the nearest one xAI accepts instead of sending e.g. "512" and being refused.
const XAI_TIERS: readonly ResolutionTier[] = ["1k", "2k"];

export function xaiResolution(tier: ResolutionTier | undefined): "1k" | "2k" {
  return nearestTier(tier ?? "1k", XAI_TIERS) as "1k" | "2k";
}

async function generateImages(p: ImageGenParams): Promise<GeneratedImage[]> {
  const settings = loadSettings();
  const model = resolveImageModel("xai", p.model, settings);
  const data = await xaiRequest<{ data: RawImage[] }>("/v1/images/generations", {
    method: "POST",
    signal: p.signal,
    body: JSON.stringify({
      model,
      prompt: p.prompt,
      n: p.n ?? 1,
      aspect_ratio: p.aspect_ratio ?? "1:1",
      resolution: xaiResolution(p.resolution),
      response_format: "b64_json",
    }),
  });
  return data.data.map(normalizeImage);
}

async function editImages(p: ImageEditParams): Promise<GeneratedImage[]> {
  const settings = loadSettings();
  const body: Record<string, unknown> = {
    model: p.model ?? settings.imageModel,
    prompt: p.prompt,
    n: p.n ?? 1,
    resolution: xaiResolution(p.resolution),
    response_format: "b64_json",
  };
  if (p.images.length === 1) {
    body.image = { url: p.images[0] };
  } else {
    body.images = p.images.map((url) => ({ url }));
  }

  const data = await xaiRequest<{ data: RawImage[] }>("/v1/images/edits", {
    method: "POST",
    signal: p.signal,
    body: JSON.stringify(body),
  });
  return data.data.map(normalizeImage);
}

export const xaiImageProvider: ImageProviderAdapter = {
  id: "xai",
  label: "xAI/NewAPI",
  generateImages,
  editImages,
};
