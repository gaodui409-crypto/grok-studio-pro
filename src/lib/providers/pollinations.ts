import { generatePollinationsImages } from "../pollinations.ts";
import { aspectToWH, loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams) {
  const settings = loadSettings();
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  return generatePollinationsImages({
    prompt: p.prompt,
    apiKey: settings.pollinationsApiKey ?? "",
    model: settings.pollinationsModel.trim() || "flux",
    width,
    height,
    count: p.n ?? 1,
    signal: p.signal,
  });
}

export const pollinationsImageProvider: ImageProviderAdapter = {
  id: "pollinations",
  label: "Pollinations",
  generateImages,
};
