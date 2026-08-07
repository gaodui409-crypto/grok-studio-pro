import type { ProviderId } from "../settings.ts";
import type { ImageEditingProviderAdapter, ImageProviderAdapter } from "./types.ts";

export type ImageProviderRegistry = {
  get(id: ProviderId): ImageProviderAdapter;
  requireImageEditing(id: ProviderId): ImageEditingProviderAdapter;
};

export function createImageProviderRegistry(
  adapters: readonly ImageProviderAdapter[],
): ImageProviderRegistry {
  const byId = new Map<ProviderId, ImageProviderAdapter>();

  for (const adapter of adapters) {
    if (byId.has(adapter.id)) {
      throw new Error(`重复的图片来源：${adapter.id}`);
    }
    byId.set(adapter.id, adapter);
  }

  const get = (id: ProviderId): ImageProviderAdapter => {
    const adapter = byId.get(id);
    if (!adapter) throw new Error(`未注册的图片来源：${id}`);
    return adapter;
  };

  return {
    get,
    requireImageEditing(id) {
      const adapter = get(id);
      if (!adapter.editImages) {
        throw new Error(
          `当前来源（${adapter.label}）不支持图生图，请在设置中切换到 xAI / NewAPI。`,
        );
      }
      return adapter as ImageEditingProviderAdapter;
    },
  };
}
