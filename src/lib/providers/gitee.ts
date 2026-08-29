import { generateGiteeImages, GITEE_DEFAULT_MODEL } from "../gitee.ts";
import { inferenceParams, resolveDimensions } from "../provider-catalog.ts";
import { resolveImageModel } from "../provider-runtime.ts";
import { loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams) {
  const settings = loadSettings();
  const model = resolveImageModel("gitee", p.model, settings) || GITEE_DEFAULT_MODEL;
  const { width, height } = resolveDimensions(
    "gitee",
    model,
    p.aspect_ratio ?? "1:1",
    p.resolution ?? "1k",
  );
  return generateGiteeImages({
    prompt: p.prompt,
    apiKey: settings.giteeApiKey,
    model,
    width,
    height,
    count: p.n ?? 1,
    // SDXL on Gitee needs ~30 steps; z-image-turbo needs 9. The old code sent 9
    // for everything, which under-denoised the standard models.
    params: inferenceParams("gitee", model),
    signal: p.signal,
  });
}

export const giteeImageProvider: ImageProviderAdapter = {
  id: "gitee",
  label: "Gitee AI 模力方舟",
  generateImages,
};
