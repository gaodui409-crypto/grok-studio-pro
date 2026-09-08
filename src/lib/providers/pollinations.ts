import { generatePollinationsImages } from "../pollinations.ts";
import { resolveDimensions } from "../provider-catalog.ts";
import { resolveImageModel } from "../provider-runtime.ts";
import { loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams, settings = loadSettings()) {
  const model = resolveImageModel("pollinations", p.model, settings) || "flux";
  const { width, height } = resolveDimensions(
    "pollinations",
    model,
    p.aspect_ratio ?? "1:1",
    p.resolution ?? "1k",
  );
  return generatePollinationsImages({
    prompt: p.prompt,
    apiKey: settings.pollinationsApiKey ?? "",
    model,
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
