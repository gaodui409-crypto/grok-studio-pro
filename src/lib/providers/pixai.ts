import { runPixAiGeneration } from "../pixai-client.ts";
import {
  loadSettings,
  nearestTier,
  PIXAI_DEFAULT_MODEL_VERSION_ID,
  type ResolutionTier,
} from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

const PIXAI_ASPECT_RATIOS = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "3:5",
  "5:3",
  "9:16",
  "16:9",
  "1:3",
  "3:1",
]);

// PixAI's v2 API only offers "1k" and "1.5k". Map the shared tier list onto the
// nearer of the two — "2k" becomes "1.5k" (as before), and the small tiers
// collapse to "1k" rather than being sent verbatim and rejected.
const PIXAI_TIERS: readonly ResolutionTier[] = ["1k", "1.5k"];

export function pixAiSizeFromResolution(resolution: ResolutionTier): "1k" | "1.5k" {
  return nearestTier(resolution, PIXAI_TIERS) as "1k" | "1.5k";
}

export function pixAiAspectRatio(aspectRatio: string): string {
  if (PIXAI_ASPECT_RATIOS.has(aspectRatio)) return aspectRatio;
  throw new Error(
    `PixAI 不支持画面比例：${aspectRatio}。请选择 1:1、16:9、9:16、4:3、3:4、3:2 或 2:3。`,
  );
}

async function generateImages(params: ImageGenParams) {
  const settings = loadSettings();
  return runPixAiGeneration({
    apiKey: settings.pixaiApiKey,
    prompt: params.prompt,
    modelVersionId: settings.pixaiModelVersionId.trim() || PIXAI_DEFAULT_MODEL_VERSION_ID,
    aspectRatio: pixAiAspectRatio(params.aspect_ratio ?? settings.defaultAspectRatio),
    size: pixAiSizeFromResolution(params.resolution ?? settings.defaultResolution),
    n: params.n ?? 1,
    signal: params.signal,
  });
}

export const pixAiImageProvider: ImageProviderAdapter = {
  id: "pixai",
  label: "PixAI 官方 API",
  generateImages,
};
