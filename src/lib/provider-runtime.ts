import { catalogModels } from "./provider-catalog.ts";
import { PROVIDER_MODEL_FIELD, type ProviderId, type Settings } from "./settings.ts";

export const MODELSCOPE_IMAGE_MODEL = "Tongyi-MAI/Z-Image-Turbo";

/**
 * The model id to send for `provider`.
 *
 * The requested model comes from per-page state, which is shared across
 * providers — so after switching provider it can still hold the *previous*
 * provider's id (page state defaults to a grok id). Sending that through would
 * make ModelScope reject the request, which is why this used to be hardcoded to
 * one model. Instead of ignoring the request entirely, accept it only when it
 * belongs to this provider, otherwise fall back to the provider's saved model.
 */
export function resolveImageModel(
  provider: ProviderId,
  requestedModel: string | undefined,
  settings: Settings,
): string {
  const field = PROVIDER_MODEL_FIELD[provider];
  const saved = field ? String(settings[field] ?? "") : "";

  // The generation pages keep their form state for the current session, while
  // the provider selector writes the canonical value to settings. For xAI the
  // old page value can therefore be stale after a selector change; saved wins.
  if (provider === "xai" && saved) return saved;

  if (requestedModel) {
    // xAI's model list is not in the catalog (it lives in IMAGE_MODELS), so for
    // xAI any requested id is honoured, as before.
    const known =
      provider === "xai" || catalogModels(provider).some((m) => m.id === requestedModel);
    if (known) return requestedModel;
  }

  if (saved) return saved;
  return provider === "modelscope" ? MODELSCOPE_IMAGE_MODEL : "";
}
