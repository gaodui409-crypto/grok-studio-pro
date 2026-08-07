import { huggingFaceImageProvider } from "./hugging-face.ts";
import { modelScopeImageProvider } from "./modelscope.ts";
import { createImageProviderRegistry } from "./registry.ts";
import { xaiImageProvider } from "./xai.ts";

export const imageProviderRegistry = createImageProviderRegistry([
  xaiImageProvider,
  modelScopeImageProvider,
  huggingFaceImageProvider,
]);
