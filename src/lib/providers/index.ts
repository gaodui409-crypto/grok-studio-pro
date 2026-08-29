import { aiHordeImageProvider } from "./ai-horde.ts";
import { giteeImageProvider } from "./gitee.ts";
import { modelScopeImageProvider } from "./modelscope.ts";
import { pixAiImageProvider } from "./pixai.ts";
import { pixAiWebImageProvider } from "./pixai-web.ts";
import { pixAiPoolImageProvider } from "./pixai-pool.ts";
import { pollinationsImageProvider } from "./pollinations.ts";
import { createImageProviderRegistry } from "./registry.ts";
import { xaiImageProvider } from "./xai.ts";

export const imageProviderRegistry = createImageProviderRegistry([
  xaiImageProvider,
  giteeImageProvider,
  modelScopeImageProvider,
  aiHordeImageProvider,
  pollinationsImageProvider,
  pixAiImageProvider,
  pixAiWebImageProvider,
  pixAiPoolImageProvider,
]);
