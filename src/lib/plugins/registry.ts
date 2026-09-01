// Registration, lifecycle, and the event bus.
//
// Same shape as `createImageProviderRegistry` in ../providers/registry.ts: a
// factory closing over a Map, Chinese-language errors, no module-level mutable
// state. The difference is that plugins arrive one at a time and can be taken
// away, so this one owns lifecycle as well as lookup.

import type {
  PluginConfig,
  PluginConfigField,
  PluginDefinition,
  PluginEventBus,
  PluginEventMap,
  PluginEventName,
  PluginHost,
} from "./types.ts";

/**
 * Schema defaults as a config object.
 *
 * The settings page needs this to render a form before anything has been saved,
 * and the registry needs it so a plugin's `onInit` never sees a field its schema
 * declared as missing. Fields with no default are simply absent rather than
 * present-and-empty: a plugin can then tell "not configured" from "set to
 * empty", which is the distinction a required credential turns on.
 */
export function configDefaults(schema: readonly PluginConfigField[] = []): PluginConfig {
  const config: PluginConfig = {};
  for (const field of schema) {
    if (field.kind === "secret") continue;
    if (field.defaultValue !== undefined) config[field.key] = field.defaultValue;
  }
  return config;
}

type Registered = {
  plugin: PluginDefinition;
  /** Unsubscribes for every `bus.on` this plugin made, run at unregister. */
  disposers: (() => void)[];
};

export type PluginRegistry = {
  register(plugin: PluginDefinition): Promise<void>;
  /** False when nothing was registered under that id. */
  unregister(id: string): Promise<boolean>;
  get(id: string): PluginDefinition | undefined;
  list(): PluginDefinition[];
  /** Registered plugins that can act as a page source, for the uploader's menu. */
  imageSources(): PluginDefinition[];
  /** The host-facing side of the bus: emit to plugins, or listen from the app. */
  bus: PluginEventBus;
};

export type PluginRegistryOptions = {
  /**
   * Saved config for a plugin, merged over its schema defaults. The settings page
   * supplies this; without it every plugin sees defaults only.
   */
  readConfig?: (id: string) => PluginConfig | undefined;
  /** Defaults to `console`. Swapped in tests to assert on plugin output. */
  logger?: Pick<Console, "log" | "error">;
};

export function createPluginRegistry(options: PluginRegistryOptions = {}): PluginRegistry {
  const { readConfig, logger = console } = options;
  const registered = new Map<string, Registered>();
  const handlers = new Map<string, Set<(payload: never) => void>>();

  const emit: PluginEventBus["emit"] = (event, payload) => {
    // Copied before iterating: a handler is allowed to unsubscribe — its own or
    // another's — and mutating the live Set mid-iteration would skip a handler.
    for (const handler of [...(handlers.get(event) ?? [])]) {
      try {
        (handler as (p: PluginEventMap[typeof event]) => void)(payload);
      } catch (error) {
        // One misbehaving plugin must not stop the others from being notified, and
        // must not surface as an exception inside whatever called emit.
        logger.error(`插件事件处理出错：${event}`, error);
      }
    }
  };

  const on: PluginEventBus["on"] = (event, handler) => {
    const set = handlers.get(event) ?? new Set();
    handlers.set(event, set);
    set.add(handler as (payload: never) => void);
    return () => {
      set.delete(handler as (payload: never) => void);
      if (set.size === 0) handlers.delete(event);
    };
  };

  const bus: PluginEventBus = { on, emit };

  /** The bus a plugin sees: identical, except its subscriptions are tracked. */
  const scopedBus = (disposers: (() => void)[]): PluginEventBus => ({
    emit,
    on<K extends PluginEventName>(event: K, handler: (payload: PluginEventMap[K]) => void) {
      const dispose = on(event, handler);
      disposers.push(dispose);
      return dispose;
    },
  });

  return {
    bus,

    async register(plugin) {
      if (registered.has(plugin.id)) throw new Error(`重复的插件：${plugin.id}`);

      const entry: Registered = { plugin, disposers: [] };
      // Inserted before `onInit` is awaited, not after: the await is a point where
      // another register can run, and a plugin that is halfway through init still
      // owns its id. Removed again below if init fails.
      registered.set(plugin.id, entry);

      const host: PluginHost = {
        config: { ...configDefaults(plugin.configSchema), ...readConfig?.(plugin.id) },
        bus: scopedBus(entry.disposers),
        log: (...args) => logger.log(`[${plugin.id}]`, ...args),
      };

      try {
        await plugin.onInit?.(host);
      } catch (error) {
        // A plugin that threw during init is left unregistered rather than
        // half-alive. onDestroy still runs, because init may have got far enough
        // to open something that needs closing.
        registered.delete(plugin.id);
        for (const dispose of entry.disposers) dispose();
        try {
          await plugin.onDestroy?.();
        } catch (cleanupError) {
          logger.error(`插件 ${plugin.id} 初始化失败后清理也失败`, cleanupError);
        }
        throw error;
      }
    },

    async unregister(id) {
      const entry = registered.get(id);
      // Returns false instead of throwing, unlike the provider registry's `get`:
      // tearing down twice is a normal thing for cleanup code to do, and it should
      // not have to check first.
      if (!entry) return false;
      registered.delete(id);
      try {
        await entry.plugin.onDestroy?.();
      } finally {
        // In `finally`: a plugin whose onDestroy threw must still lose its
        // listeners, or it keeps receiving events after it is gone.
        for (const dispose of entry.disposers) dispose();
      }
      return true;
    },

    get: (id) => registered.get(id)?.plugin,
    list: () => [...registered.values()].map((entry) => entry.plugin),
    imageSources: () =>
      [...registered.values()].map((e) => e.plugin).filter((plugin) => plugin.imageSource),
  };
}
