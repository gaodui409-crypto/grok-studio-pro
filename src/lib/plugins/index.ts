// The app-facing surface, mirroring ../providers/index.ts.
//
// Deliberately empty: nothing is registered, because no concrete plugin exists yet.
// The registry is here rather than deferred so the settings page and the comic
// uploader have one place to read from when the first plugin lands — a skeleton
// with no attachment point is just types.

import { createPluginRegistry } from "./registry.ts";

export { createPluginRegistry, configDefaults } from "./registry.ts";
export type { PluginRegistry, PluginRegistryOptions } from "./registry.ts";
export type {
  PluginConfig,
  PluginConfigField,
  PluginConfigValue,
  PluginDefinition,
  PluginEventBus,
  PluginEventMap,
  PluginEventName,
  PluginHost,
  PluginImageSource,
} from "./types.ts";

/**
 * The app's registry.
 *
 * `readConfig` is unset, so plugins currently see schema defaults only. Wiring it
 * to localStorage is the settings page's job and belongs with the form that writes
 * the values, not here.
 */
export const pluginRegistry = createPluginRegistry();
