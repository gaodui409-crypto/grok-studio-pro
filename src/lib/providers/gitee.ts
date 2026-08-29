import { generateGiteeImages, GITEE_DEFAULT_MODEL } from "../gitee.ts";
import { aspectToWH, loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams) {
  const settings = loadSettings();
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  return generateGiteeImages({
    prompt: p.prompt,
    apiKey: settings.giteeApiKey,
    model: settings.giteeModel.trim() || GITEE_DEFAULT_MODEL,
    width,
    height,
    count: p.n ?? 1,
    signal: p.signal,
  });
}

export const giteeImageProvider: ImageProviderAdapter = {
  id: "gitee",
  label: "Gitee AI 模力方舟",
  generateImages,
};
