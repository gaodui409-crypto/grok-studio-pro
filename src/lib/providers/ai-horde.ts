import { runAiHordeGeneration } from "../ai-horde-client.ts";
import { aspectToWH, loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

const ANONYMOUS_AI_HORDE_KEY = "0000000000";

async function generateImages(p: ImageGenParams) {
  const settings = loadSettings();
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  return runAiHordeGeneration({
    prompt: p.prompt,
    apiKey: settings.aiHordeApiKey.trim() || ANONYMOUS_AI_HORDE_KEY,
    width,
    height,
    count: p.n ?? 1,
    signal: p.signal,
  });
}

export const aiHordeImageProvider: ImageProviderAdapter = {
  id: "aihorde",
  label: "AI Horde",
  generateImages,
};
