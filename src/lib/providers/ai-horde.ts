import { runAiHordeGeneration } from "../ai-horde-client.ts";
import { resolveDimensions } from "../provider-catalog.ts";
import { resolveImageModel } from "../provider-runtime.ts";
import { loadSettings } from "../settings.ts";
import type { ImageGenParams, ImageProviderAdapter } from "./types.ts";

const ANONYMOUS_AI_HORDE_KEY = "0000000000";

async function generateImages(p: ImageGenParams) {
  const settings = loadSettings();
  const model = resolveImageModel("aihorde", p.model, settings);
  const { width, height } = resolveDimensions(
    "aihorde",
    model,
    p.aspect_ratio ?? "1:1",
    p.resolution ?? "1k",
  );
  return runAiHordeGeneration({
    prompt: p.prompt,
    apiKey: settings.aiHordeApiKey.trim() || ANONYMOUS_AI_HORDE_KEY,
    width,
    height,
    count: p.n ?? 1,
    // Empty = let any worker take the job, which is the better default on a
    // volunteer network. A named model restricts it to workers running that model.
    model: model || undefined,
    signal: p.signal,
  });
}

export const aiHordeImageProvider: ImageProviderAdapter = {
  id: "aihorde",
  label: "AI Horde",
  generateImages,
};
