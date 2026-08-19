import { runPixAiWebGeneration } from "../pixai-web-client.ts";
import { loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

export function pixAiWebDimensions(
  aspectRatio: string,
  resolution: "1k" | "2k",
): { width: number; height: number } {
  const match = /^(\d+):(\d+)$/.exec(aspectRatio);
  if (!match) {
    throw new Error(`PixAI 网页渠道不支持画面比例：${aspectRatio}。请选择明确的宽高比。`);
  }

  const ratioWidth = Number(match[1]);
  const ratioHeight = Number(match[2]);
  if (ratioWidth <= 0 || ratioHeight <= 0) {
    throw new Error(`PixAI 网页渠道不支持画面比例：${aspectRatio}。宽高比必须大于零。`);
  }

  const longestSide = resolution === "2k" ? 1536 : 1024;
  if (ratioWidth >= ratioHeight) {
    return {
      width: longestSide,
      height: Math.max(8, Math.round((longestSide * ratioHeight) / ratioWidth / 8) * 8),
    };
  }
  return {
    width: Math.max(8, Math.round((longestSide * ratioWidth) / ratioHeight / 8) * 8),
    height: longestSide,
  };
}

async function generateImages(params: ImageGenParams) {
  const settings = loadSettings();
  const dimensions = pixAiWebDimensions(
    params.aspect_ratio ?? settings.defaultAspectRatio,
    params.resolution ?? settings.defaultResolution,
  );

  return runPixAiWebGeneration({
    token: settings.pixaiWebToken,
    prompt: params.prompt,
    modelId: settings.pixaiWebModelId.trim(),
    ...dimensions,
    n: params.n ?? 1,
    signal: params.signal,
  });
}

export const pixAiWebImageProvider: ImageProviderAdapter = {
  id: "pixai-web",
  label: "PixAI 网页 Token（实验性）",
  generateImages,
};
