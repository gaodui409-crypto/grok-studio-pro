import { runPixAiWebGeneration } from "../pixai-web-client.ts";
import { loadSettings, tierEdge, type ResolutionTier } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

// PixAI's web protocol maxes out at 1536 on the long edge.
const PIXAI_WEB_MAX_EDGE = 1536;

export function pixAiWebDimensions(
  aspectRatio: string,
  resolution: ResolutionTier,
): { width: number; height: number } {
  const match = /^(\d+):(\d+)$/.exec(aspectRatio);
  if (!match) {
    throw new Error(`PixAI 网页渠道不支持画面比例：${aspectRatio}。请选择明确的宽高比。`);
  }

  const ratioWidth = Number(match[1]);
  const ratioHeight = Number(match[2]);
  if (
    !Number.isFinite(ratioWidth) ||
    !Number.isFinite(ratioHeight) ||
    ratioWidth <= 0 ||
    ratioHeight <= 0
  ) {
    throw new Error(
      `PixAI 网页渠道不支持画面比例：${aspectRatio}。宽高比必须是有限且大于零的数字。`,
    );
  }

  const longestSide = Math.min(tierEdge(resolution), PIXAI_WEB_MAX_EDGE);
  const rawShortSide =
    ratioWidth >= ratioHeight
      ? (longestSide * ratioHeight) / ratioWidth
      : (longestSide * ratioWidth) / ratioHeight;
  if (!Number.isFinite(rawShortSide) || rawShortSide < 8) {
    throw new Error("PixAI 网页渠道计算出的图片尺寸无效，短边必须是有限且至少 8 像素。");
  }

  const alignedShortSide = Math.round(rawShortSide / 8) * 8;
  const dimensions =
    ratioWidth >= ratioHeight
      ? {
          width: longestSide,
          height: alignedShortSide,
        }
      : {
          width: alignedShortSide,
          height: longestSide,
        };

  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width < 8 ||
    dimensions.height < 8
  ) {
    throw new Error("PixAI 网页渠道计算出的图片尺寸无效，必须是有限且至少 8 像素。");
  }

  return dimensions;
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
