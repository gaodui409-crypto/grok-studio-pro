// The plugin contract: what a plugin declares, and what it is handed at init.
//
// Shaped after the provider adapters in `src/lib/providers/` — a plain object with
// an id and some optional capabilities, registered in a Map — because that pattern
// already works here and a second, different extension mechanism would be one more
// thing to learn for no gain.
//
// Nothing in this module runs anything. The registry does that; see registry.ts.

import type { ImportedPage } from "../comic-import.ts";

// Re-exported so this file is the whole contract: a plugin author should not have
// to know that the page type happens to live in the CBZ importer.
export type { ImportedPage };

/**
 * One config field a plugin asks the settings page to render.
 *
 * The four kinds map 1:1 onto controls the settings page already has (`Input`,
 * `SecretInput`, a number `Input`, and `Select`), so an auto-rendered plugin form
 * needs no new widgets. There is deliberately no boolean kind: the repo has no
 * Switch component, and adding one for a schema nobody has filled in yet would be
 * inventing a requirement.
 */
export type PluginConfigField = { key: string; label: string; hint?: string } & (
  | { kind: "text"; placeholder?: string; defaultValue?: string }
  // Rendered masked, and — like every other credential here — stored in
  // localStorage. No defaultValue: a shipped default credential is never right.
  | { kind: "secret"; placeholder?: string }
  | { kind: "number"; min?: number; max?: number; step?: number; defaultValue?: number }
  | {
      kind: "select";
      options: readonly { value: string; label: string }[];
      defaultValue?: string;
    }
);

export type PluginConfigValue = string | number;

/** A plugin's saved config: field key to value, as flat as the fields are. */
export type PluginConfig = Record<string, PluginConfigValue>;

/**
 * Events the host itself publishes.
 *
 * An interface rather than a type so a plugin can add its own events by declaring
 * the same interface — standard declaration merging, no runtime cost, and a
 * plugin-to-plugin message stays type-checked at both ends. See example-plugin.ts.
 */
export interface PluginEventMap {
  /** Pages reached the uploader, whoever produced them. */
  "pages:imported": { pluginId: string; pages: ImportedPage[] };
  /** A plugin's config was saved. Carries the whole config, not a delta. */
  "config:changed": { pluginId: string; config: PluginConfig };
}

export type PluginEventName = keyof PluginEventMap & string;

/**
 * Typed pub/sub between plugins and the host.
 *
 * A plain Map of Sets rather than the `window` + `CustomEvent` pair used elsewhere
 * in this repo (see quota.ts). Two reasons: payloads stay typed instead of being
 * cast out of `CustomEvent.detail` at every listener, and the bus is an object the
 * registry owns, so unregistering a plugin can actually drop its listeners. A
 * global `window` listener is not attributable to the plugin that added it.
 *
 * `on` returns its own unsubscribe. There is no `off`: forgetting to keep a
 * handler reference around is the usual way listeners leak, and the registry
 * drops a plugin's subscriptions for it at unregister anyway.
 */
export type PluginEventBus = {
  on<K extends PluginEventName>(
    event: K,
    handler: (payload: PluginEventMap[K]) => void,
  ): () => void;
  emit<K extends PluginEventName>(event: K, payload: PluginEventMap[K]): void;
};

/**
 * A plugin that can hand pages to the comic uploader.
 *
 * Returns `ImportedPage[]` — the type the CBZ importer already produces and the
 * uploader already consumes — so a plugin source lands in `handleFiles`'s existing
 * flow with no converter in between. `limit` is the uploader's remaining room, and
 * it is a hard cap, not a hint: the caller has already counted what it can hold.
 */
export type PluginImageSource = {
  /** Shown on the button that invokes it. */
  label: string;
  load(limit: number, signal?: AbortSignal): Promise<ImportedPage[]>;
};

/** What a plugin is handed at init. Its only channel to the host. */
export type PluginHost = {
  /** This plugin's saved config, with schema defaults filled in. */
  config: PluginConfig;
  /** Subscriptions made through this bus are dropped when the plugin unregisters. */
  bus: PluginEventBus;
  /** Prefixed with the plugin id, so a noisy plugin is identifiable in the console. */
  log(...args: unknown[]): void;
};

export type PluginDefinition = {
  id: string;
  label: string;
  description?: string;
  /** Fields the settings page renders for this plugin. Omit if it needs no config. */
  configSchema?: readonly PluginConfigField[];
  /**
   * Called once at register. Throwing here aborts the registration — the plugin is
   * left unregistered rather than half-alive.
   */
  onInit?(host: PluginHost): void | Promise<void>;
  /** Called at unregister. Runs even if `onInit` threw, so partial setup can be undone. */
  onDestroy?(): void | Promise<void>;
  /** Present only on plugins that act as a page source. */
  imageSource?: PluginImageSource;
};
