import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, type ProviderId, type Settings } from "./settings.ts";
import {
  dailyLimit,
  loadLedger,
  pruneLedger,
  quotaStatus,
  recordUsage,
  resetUsage,
  todayKey,
  usedToday,
  type QuotaLedger,
} from "./quota.ts";

// Minimal localStorage + window stand-in. The module reads through
// `typeof window === "undefined"` guards, so both have to exist together.
function installBrowser() {
  const store = new Map<string, string>();
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
  g.CustomEvent = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  g.window = { dispatchEvent: () => true, localStorage: g.localStorage };
  return () => {
    delete g.window;
    delete g.localStorage;
    delete g.CustomEvent;
  };
}

function settingsWith(limits: Partial<Record<ProviderId, number>>): Settings {
  return { ...defaultSettings, dailyLimits: limits };
}

test("recordUsage 累加当天计数", () => {
  const restore = installBrowser();
  try {
    assert.equal(usedToday("gitee"), 0);
    recordUsage("gitee", 3);
    recordUsage("gitee", 2);
    assert.equal(usedToday("gitee"), 5);
    // Other providers stay independent.
    assert.equal(usedToday("modelscope"), 0);
  } finally {
    restore();
  }
});

test("recordUsage 忽略非正数（失败请求不计费）", () => {
  const restore = installBrowser();
  try {
    recordUsage("gitee", 0);
    recordUsage("gitee", -4);
    assert.equal(usedToday("gitee"), 0);
  } finally {
    restore();
  }
});

test("resetUsage 只清目标渠道", () => {
  const restore = installBrowser();
  try {
    recordUsage("gitee", 4);
    recordUsage("pollinations", 7);
    resetUsage("gitee");
    assert.equal(usedToday("gitee"), 0);
    assert.equal(usedToday("pollinations"), 7);
  } finally {
    restore();
  }
});

test("pruneLedger 丢弃非当天的记录", () => {
  const today = todayKey();
  const ledger: QuotaLedger = {
    gitee: { [today]: 5, "2020-01-01": 99 },
    modelscope: { "2020-01-01": 12 },
  };
  const pruned = pruneLedger(ledger, today);
  assert.deepEqual(pruned, { gitee: { [today]: 5 } });
  // A provider with no entry for today disappears entirely rather than lingering
  // as an empty object.
  assert.equal("modelscope" in pruned, false);
});

test("未设上限视为无限，而不是 0 剩余", () => {
  const s = settingsWith({});
  assert.equal(dailyLimit(s, "gitee"), null);
  const status = quotaStatus(s, "gitee", { gitee: { [todayKey()]: 500 } });
  assert.equal(status.limit, null);
  assert.equal(status.remaining, null);
  assert.equal(status.exhausted, false);
});

test("上限为 0 或负数同样视为未设", () => {
  assert.equal(dailyLimit(settingsWith({ gitee: 0 }), "gitee"), null);
  assert.equal(dailyLimit(settingsWith({ gitee: -10 }), "gitee"), null);
});

test("quotaStatus 计算剩余与耗尽", () => {
  const s = settingsWith({ gitee: 100 });
  const today = todayKey();
  const partial = quotaStatus(s, "gitee", { gitee: { [today]: 13 } });
  assert.equal(partial.used, 13);
  assert.equal(partial.remaining, 87);
  assert.equal(partial.exhausted, false);

  const spent = quotaStatus(s, "gitee", { gitee: { [today]: 100 } });
  assert.equal(spent.remaining, 0);
  assert.equal(spent.exhausted, true);

  // Over-count (vendor served more than the cap, or the cap was lowered) must
  // clamp at 0 rather than going negative.
  const over = quotaStatus(s, "gitee", { gitee: { [today]: 140 } });
  assert.equal(over.remaining, 0);
  assert.equal(over.exhausted, true);
});

test("low 在剩余 20% 及以下时为真，耗尽后转为 false", () => {
  const s = settingsWith({ gitee: 100 });
  const today = todayKey();
  assert.equal(quotaStatus(s, "gitee", { gitee: { [today]: 79 } }).low, false);
  assert.equal(quotaStatus(s, "gitee", { gitee: { [today]: 80 } }).low, true);
  assert.equal(quotaStatus(s, "gitee", { gitee: { [today]: 99 } }).low, true);
  // Exhausted is its own state — warning about "almost out" when it is fully out
  // would show two conflicting signals at once.
  const spent = quotaStatus(s, "gitee", { gitee: { [today]: 100 } });
  assert.equal(spent.low, false);
  assert.equal(spent.exhausted, true);
});

test("上限很小时 low 至少保留 1 张的预警窗口", () => {
  // 20% of 3 is 0.6; flooring would make `low` unreachable on tiny caps.
  const s = settingsWith({ aihorde: 3 });
  const today = todayKey();
  assert.equal(quotaStatus(s, "aihorde", { aihorde: { [today]: 2 } }).low, true);
});

test("坏数据不会让计数崩掉", () => {
  const restore = installBrowser();
  try {
    localStorage.setItem("grok-studio-quota", "{not json");
    assert.deepEqual(loadLedger(), {});
    localStorage.setItem("grok-studio-quota", '"a string"');
    assert.deepEqual(loadLedger(), {});
    localStorage.setItem("grok-studio-quota", "null");
    assert.deepEqual(loadLedger(), {});
  } finally {
    restore();
  }
});

test("负数计数被当作 0 而不是负剩余", () => {
  const s = settingsWith({ gitee: 10 });
  const status = quotaStatus(s, "gitee", { gitee: { [todayKey()]: -5 } });
  assert.equal(status.used, 0);
  assert.equal(status.remaining, 10);
});
