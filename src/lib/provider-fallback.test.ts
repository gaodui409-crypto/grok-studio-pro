import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, type ProviderId, type Settings } from "./settings.ts";
import { chooseProvider } from "./provider-fallback.ts";
import { todayKey, type QuotaLedger } from "./quota.ts";

// chooseProvider reads the ledger through loadLedger(), which needs a browser.
// Seeding localStorage directly keeps the test honest about the real read path
// instead of injecting a ledger the production code never uses.
function withLedger(ledger: QuotaLedger, fn: () => void) {
  const store = new Map<string, string>([["grok-studio-quota", JSON.stringify(ledger)]]);
  const g = globalThis as unknown as {
    window?: unknown;
    localStorage?: unknown;
    CustomEvent?: unknown;
  };
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  // Explicit field, not a parameter property: node --experimental-strip-types
  // rejects `constructor(public type: string)`.
  g.CustomEvent = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  g.window = { dispatchEvent: () => true };
  try {
    fn();
  } finally {
    delete g.window;
    delete g.localStorage;
    delete g.CustomEvent;
  }
}

// Gitee + Pollinations configured, xAI selected but keyless.
function twoFreeChannels(overrides: Partial<Settings> = {}): Settings {
  return {
    ...defaultSettings,
    provider: "gitee",
    giteeApiKey: "k1",
    pollinationsApiKey: "k2",
    dailyLimits: { gitee: 10, pollinations: 10 },
    ...overrides,
  };
}

test("额度充足时用选定渠道，不切换", () => {
  withLedger({}, () => {
    const choice = chooseProvider(twoFreeChannels());
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, undefined);
  });
});

test("选定渠道耗尽时切到下一个可用渠道", () => {
  withLedger({ gitee: { [todayKey()]: 10 } }, () => {
    const choice = chooseProvider(twoFreeChannels());
    assert.equal(choice.provider, "pollinations");
    assert.equal(choice.switchedFrom, "gitee");
    assert.equal(choice.reason, "exhausted");
  });
});

test("全部耗尽时退回原渠道，让厂商自己报错", () => {
  // The local tally can be wrong; refusing locally would deny a request the
  // vendor might still serve.
  withLedger({ gitee: { [todayKey()]: 10 }, pollinations: { [todayKey()]: 10 } }, () => {
    const choice = chooseProvider(twoFreeChannels());
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, undefined);
  });
});

test("未配置的渠道被跳过", () => {
  withLedger({}, () => {
    // xai selected but has no key, so it is not in enabledProviders.
    const choice = chooseProvider(twoFreeChannels({ provider: "xai", apiKey: "" }));
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, "xai");
    assert.equal(choice.reason, "unconfigured");
  });
});

test("没有任何可用渠道时返回原选择", () => {
  withLedger({}, () => {
    const bare: Settings = { ...defaultSettings, provider: "xai", apiKey: "" };
    assert.equal(chooseProvider(bare).provider, "xai");
  });
});

test("无上限的渠道永远不会被当作耗尽", () => {
  withLedger({ gitee: { [todayKey()]: 9999 } }, () => {
    const choice = chooseProvider(twoFreeChannels({ dailyLimits: {} }));
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, undefined);
  });
});

test("可显式指定渠道，仍受额度约束", () => {
  withLedger({ pollinations: { [todayKey()]: 10 } }, () => {
    const choice = chooseProvider(twoFreeChannels(), "pollinations" as ProviderId);
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, "pollinations");
  });
});

test("匿名 AI Horde 不会成为自动降级目标", () => {
  // No key = 0 Kudos = lowest priority and a ~711px ceiling. Reachable by hand,
  // never by silent redirect.
  withLedger({ gitee: { [todayKey()]: 10 }, pollinations: { [todayKey()]: 10 } }, () => {
    const choice = chooseProvider(twoFreeChannels());
    assert.notEqual(choice.provider, "aihorde");
    assert.equal(choice.provider, "gitee");
  });
});

test("填了 key 的 AI Horde 可以作为降级目标", () => {
  withLedger({ gitee: { [todayKey()]: 10 }, pollinations: { [todayKey()]: 10 } }, () => {
    const choice = chooseProvider(twoFreeChannels({ aiHordeApiKey: "real-key" }));
    assert.equal(choice.provider, "aihorde");
    assert.equal(choice.switchedFrom, "gitee");
  });
});

test("自动降级不会未经授权使用已配置的 xAI", () => {
  withLedger({ gitee: { [todayKey()]: 10 } }, () => {
    const settings = twoFreeChannels({
      apiKey: "paid-xai-key",
      pollinationsApiKey: "",
      dailyLimits: { gitee: 10 },
    });
    const choice = chooseProvider(settings);
    assert.equal(choice.provider, "gitee");
    assert.equal(choice.switchedFrom, undefined);
  });
});

test("明确允许后 xAI 才能作为自动降级目标", () => {
  withLedger({ gitee: { [todayKey()]: 10 } }, () => {
    const settings = twoFreeChannels({
      apiKey: "paid-xai-key",
      pollinationsApiKey: "",
      dailyLimits: { gitee: 10 },
      allowPaidFallback: true,
    });
    const choice = chooseProvider(settings);
    assert.equal(choice.provider, "xai");
    assert.equal(choice.switchedFrom, "gitee");
  });
});

test("显式选中匿名 AI Horde 时照常使用", () => {
  withLedger({}, () => {
    const choice = chooseProvider(twoFreeChannels({ provider: "aihorde" }));
    assert.equal(choice.provider, "aihorde");
    assert.equal(choice.switchedFrom, undefined);
  });
});

test("切换顺序跟随 PROVIDERS 顺序（用户在设置里看到的顺序）", () => {
  const s = twoFreeChannels({
    provider: "pollinations",
    modelscopeToken: "k3",
    dailyLimits: { pollinations: 10 },
  });
  withLedger({ pollinations: { [todayKey()]: 10 } }, () => {
    // gitee precedes modelscope in PROVIDERS, so it wins.
    assert.equal(chooseProvider(s).provider, "gitee");
  });
});
