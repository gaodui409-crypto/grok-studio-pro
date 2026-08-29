import type { ProviderId } from "./settings.ts";

export const MODELSCOPE_IMAGE_MODEL = "Tongyi-MAI/Z-Image-Turbo";

export type ProviderModels = {
  xai: string;
};

export function resolveImageModel(
  provider: ProviderId,
  requestedModel: string | undefined,
  models: ProviderModels,
): string {
  if (provider === "modelscope") return MODELSCOPE_IMAGE_MODEL;
  return requestedModel || models.xai;
}
