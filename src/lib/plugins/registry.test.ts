import assert from "node:assert/strict";
import { test } from "node:test";
import { examplePlugin } from "./example-plugin.ts";
import { configDefaults, createPluginRegistry } from "./registry.ts";
import type { PluginConfigField, PluginDefinition } from "./types.ts";

/** Silences the registry's own error reporting and lets a test assert on it. */
function fakeLogger() {
  const logged: unknown[][] = [];
  const errors: unknown[][] = [];
  return {
    logged,
    errors,
    log: (...args: unknown[]) => logged.push(args),
    error: (...args: unknown[]) => errors.push(args),
  };
}

/** A plugin that records which hooks ran, in order. */
function tracked(id: string, extra: Partial<PluginDefinition> = {}) {
  const calls: string[] = [];
  const plugin: PluginDefinition = {
    id,
    label: id,
    onInit: () => void calls.push("init"),
    onDestroy: () => void calls.push("destroy"),
    ...extra,
  };
  return { plugin, calls };
}

test("注册后能查到，并且 onInit 跑过一次", async () => {
  const registry = createPluginRegistry({ logger: fakeLogger() });
  const { plugin, calls } = tracked("a");

  await registry.register(plugin);

  assert.deepEqual(calls, ["init"]);
  assert.equal(registry.get("a"), plugin);
  assert.deepEqual(
    registry.list().map((p) => p.id),
    ["a"],
  );
});

test("重复 id 直接报错，不会覆盖已注册的插件", async () => {
  const registry = createPluginRegistry({ logger: fakeLogger() });
  const first = tracked("dup");
  const second = tracked("dup");

  await registry.register(first.plugin);
  await assert.rejects(() => registry.register(second.plugin), /重复的插件：dup/);

  assert.equal(registry.get("dup"), first.plugin);
  assert.deepEqual(second.calls, []);
});

test("注销会跑 onDestroy 并从列表里消失", async () => {
  const registry = createPluginRegistry({ logger: fakeLogger() });
  const { plugin, calls } = tracked("a");

  await registry.register(plugin);
  assert.equal(await registry.unregister("a"), true);

  assert.deepEqual(calls, ["init", "destroy"]);
  assert.equal(registry.get("a"), undefined);
  assert.deepEqual(registry.list(), []);
});

test("注销不认识的 id 返回 false，而不是抛异常", async () => {
  // Cleanup code calling unregister twice is normal and should not need a guard.
  const registry = createPluginRegistry({ logger: fakeLogger() });
  assert.equal(await registry.unregister("nope"), false);
});

test("onInit 抛错时插件留在未注册状态，但清理仍然跑", async () => {
  // The failure mode this rules out is a half-alive plugin: listed, so the UI
  // offers it, but never initialised.
  const logger = fakeLogger();
  const registry = createPluginRegistry({ logger });
  const calls: string[] = [];

  await assert.rejects(
    () =>
      registry.register({
        id: "boom",
        label: "boom",
        onInit: () => {
          calls.push("init");
          throw new Error("初始化失败");
        },
        onDestroy: () => void calls.push("destroy"),
      }),
    /初始化失败/,
  );

  assert.deepEqual(calls, ["init", "destroy"]);
  assert.equal(registry.get("boom"), undefined);
  assert.deepEqual(registry.list(), []);
});

test("onInit 失败后 id 可以再次注册", async () => {
  // The id is claimed before onInit is awaited, so this checks the claim is
  // actually released on failure rather than blocking the id until reload.
  const registry = createPluginRegistry({ logger: fakeLogger() });
  await assert.rejects(() =>
    registry.register({
      id: "retry",
      label: "retry",
      onInit: () => {
        throw new Error("x");
      },
    }),
  );

  const { plugin } = tracked("retry");
  await registry.register(plugin);
  assert.equal(registry.get("retry"), plugin);
});

test("插件之间能通过事件总线通信", async () => {
  const registry = createPluginRegistry({ logger: fakeLogger() });
  const seen: string[] = [];

  await registry.register({
    id: "listener",
    label: "listener",
    onInit: (host) => {
      host.bus.on("pages:imported", ({ pluginId }) => seen.push(pluginId));
    },
  });
  await registry.register({
    id: "sender",
    label: "sender",
    onInit: (host) => {
      host.bus.emit("pages:imported", { pluginId: "sender", pages: [] });
    },
  });

  assert.deepEqual(seen, ["sender"]);
});

test("注销会一起收走它的订阅", async () => {
  // The leak this rules out: a plugin that is gone from the list but still runs
  // its handler on every event.
  const registry = createPluginRegistry({ logger: fakeLogger() });
  let hits = 0;

  await registry.register({
    id: "listener",
    label: "listener",
    onInit: (host) => void host.bus.on("pages:imported", () => void (hits += 1)),
  });

  registry.bus.emit("pages:imported", { pluginId: "host", pages: [] });
  assert.equal(hits, 1);

  await registry.unregister("listener");
  registry.bus.emit("pages:imported", { pluginId: "host", pages: [] });
  assert.equal(hits, 1);
});

test("onDestroy 抛错也要收走订阅", async () => {
  const logger = fakeLogger();
  const registry = createPluginRegistry({ logger });
  let hits = 0;

  await registry.register({
    id: "rude",
    label: "rude",
    onInit: (host) => void host.bus.on("pages:imported", () => void (hits += 1)),
    onDestroy: () => {
      throw new Error("清理失败");
    },
  });

  await assert.rejects(() => registry.unregister("rude"), /清理失败/);
  registry.bus.emit("pages:imported", { pluginId: "host", pages: [] });
  assert.equal(hits, 0);
});

test("一个处理函数抛错不影响其他插件收到事件", async () => {
  const logger = fakeLogger();
  const registry = createPluginRegistry({ logger });
  let reached = false;

  await registry.register({
    id: "throws",
    label: "throws",
    onInit: (host) =>
      void host.bus.on("pages:imported", () => {
        throw new Error("处理出错");
      }),
  });
  await registry.register({
    id: "ok",
    label: "ok",
    onInit: (host) => void host.bus.on("pages:imported", () => void (reached = true)),
  });

  // Must not throw out of emit — the caller is the host, not the faulty plugin.
  registry.bus.emit("pages:imported", { pluginId: "host", pages: [] });

  assert.equal(reached, true);
  assert.equal(logger.errors.length, 1);
});

test("处理函数中途退订不会漏掉同一批的其他处理函数", async () => {
  // Iterating the live Set would skip a handler when an earlier one removes itself.
  const registry = createPluginRegistry({ logger: fakeLogger() });
  let second = false;

  await registry.register({
    id: "once",
    label: "once",
    onInit: (host) => {
      const off = host.bus.on("pages:imported", () => off());
    },
  });
  await registry.register({
    id: "after",
    label: "after",
    onInit: (host) => void host.bus.on("pages:imported", () => void (second = true)),
  });

  registry.bus.emit("pages:imported", { pluginId: "host", pages: [] });
  assert.equal(second, true);
});

test("配置默认值来自 schema，保存过的值覆盖它", async () => {
  const schema: PluginConfigField[] = [
    { key: "perPage", kind: "number", label: "每次导入页数", defaultValue: 20 },
    { key: "quality", kind: "select", label: "画质", options: [], defaultValue: "original" },
    { key: "endpoint", kind: "text", label: "接口地址" },
  ];
  // No default, and none invented: a plugin has to be able to tell "never set" from
  // "set to empty", which is what a required credential check turns on.
  assert.deepEqual(configDefaults(schema), { perPage: 20, quality: "original" });

  const registry = createPluginRegistry({
    logger: fakeLogger(),
    readConfig: () => ({ perPage: 5 }),
  });
  let seen: unknown;
  await registry.register({
    id: "cfg",
    label: "cfg",
    configSchema: schema,
    onInit: (host) => void (seen = host.config),
  });

  assert.deepEqual(seen, { perPage: 5, quality: "original" });
});

test("secret 字段永远没有默认值", () => {
  // A shipped default credential is never right, so the type forbids it and this
  // pins the behaviour for a schema that came from untyped JSON.
  const schema = [
    { key: "token", kind: "secret", label: "访问令牌", defaultValue: "leaked" },
  ] as unknown as PluginConfigField[];
  assert.deepEqual(configDefaults(schema), {});
});

test("只有声明了 imageSource 的插件会出现在图片来源里", async () => {
  const registry = createPluginRegistry({ logger: fakeLogger() });
  await registry.register(tracked("plain").plugin);
  await registry.register(
    tracked("source", {
      imageSource: { label: "从测试导入", load: async () => [] },
    }).plugin,
  );

  assert.deepEqual(
    registry.imageSources().map((p) => p.id),
    ["source"],
  );
});

test("示例插件能完整走一遍注册和注销", async () => {
  // The skeleton is what a new plugin gets copied from, so it has to actually
  // satisfy the contract rather than merely compile.
  const logger = fakeLogger();
  const registry = createPluginRegistry({ logger });

  await registry.register(examplePlugin);
  assert.deepEqual(
    registry.imageSources().map((p) => p.id),
    ["example"],
  );
  assert.deepEqual(await examplePlugin.imageSource?.load(10), []);

  assert.equal(await registry.unregister("example"), true);
  assert.deepEqual(registry.list(), []);
  assert.deepEqual(logger.errors, []);
});
