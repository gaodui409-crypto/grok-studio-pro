import { aiHordeImageProvider } from "./ai-horde.ts";
import { huggingFaceImageProvider } from "./hugging-face.ts";
import { modelScopeImageProvider } from "./modelscope.ts";
import { pixAiImageProvider } from "./pixai.ts";
import { pixAiPoolImageProvider } from "./pixai-pool.ts";
import { pollinationsImageProvider } from "./pollinations.ts";
import { createImageProviderRegistry } from "./registry.ts";
import { xaiImageProvider } from "./xai.ts";

export const imageProviderRegistry = createImageProviderRegistry([
  xaiImageProvider,
  modelScopeImageProvider,
  huggingFaceImageProvider,
  aiHordeImageProvider,
  pollinationsImageProvider,
  pixAiImageProvider,
  pixAiPoolImageProvider,
]);
