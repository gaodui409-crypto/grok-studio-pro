import { runPixAiGeneration } from "../pixai-client.ts";
import { loadSettings, PIXAI_DEFAULT_MODEL_VERSION_ID } from "../settings.ts";
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

export function pixAiSizeFromResolution(resolution: "1k" | "2k"): "1k" | "1.5k" {
  return resolution === "2k" ? "1.5k" : "1k";
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
