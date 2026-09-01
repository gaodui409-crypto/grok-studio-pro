// A skeleton plugin. Every hook is present and does nothing.
//
// It exists to be read and copied, and to keep the contract honest: if a change to
// types.ts stops this compiling, the contract broke. It is not registered anywhere
// — see index.ts, which ships an empty registry.

import type { ImportedPage, PluginDefinition, PluginHost } from "./types.ts";

/**
 * A plugin's own events, added to the host's map by declaring it again.
 *
 * The point of merging rather than casting: both the emit below and any listener in
 * another plugin are checked against this payload, so a renamed field is a compile
 * error instead of an undefined at runtime.
 */
declare module "./types.ts" {
  interface PluginEventMap {
    "example:ready": { at: number };
  }
}

export const examplePlugin: PluginDefinition = {
  id: "example",
  label: "示例插件",
  description: "骨架，用来抄。所有钩子都在，但什么都不做。",

  // Rendered by the settings page as label, control, hint — one field per entry.
  configSchema: [
    { key: "endpoint", kind: "text", label: "接口地址", placeholder: "https://" },
    { key: "token", kind: "secret", label: "访问令牌", hint: "存在浏览器 localStorage。" },
    { key: "perPage", kind: "number", label: "每次导入页数", min: 1, max: 200, defaultValue: 20 },
    {
      key: "quality",
      kind: "select",
      label: "画质",
      options: [
        { value: "original", label: "原图" },
        { value: "compressed", label: "压缩" },
      ],
      defaultValue: "original",
    },
  ],

  onInit(host: PluginHost) {
    // Nothing to set up. A real plugin opens whatever it needs here and closes it
    // in onDestroy; subscriptions made on `host.bus` are dropped for it at
    // unregister, so they need no explicit teardown.
    host.bus.on("config:changed", ({ pluginId }) => {
      if (pluginId === examplePlugin.id) host.log("配置已更新");
    });
    host.bus.emit("example:ready", { at: Date.now() });
  },

  onDestroy() {
    // Nothing to tear down.
  },

  imageSource: {
    label: "从示例插件导入",
    // Both parameters are named though unused: they are the contract a real source
    // has to honour, and an empty signature would hide it from whoever copies this.
    async load(limit: number, signal?: AbortSignal): Promise<ImportedPage[]> {
      // A real source fetches or reads here, returns at most `limit` pages in
      // reading order, and honours `signal`. Returning nothing is what makes this
      // a skeleton: the uploader treats an empty result as "found nothing".
      return [];
    },
  },
};
