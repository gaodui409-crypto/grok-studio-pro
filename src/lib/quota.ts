import { PROVIDERS, type ProviderId, type Settings } from "./settings.ts";

// Per-day, per-provider usage counters kept in localStorage.
//
// IMPORTANT: none of the eight channels exposes a "how much have I got left
// today" endpoint, so this is a LOCAL tally of what this browser sent, not the
// vendor's own number. It drifts whenever the same account is used from another
// browser/device, and whenever a request actually succeeded upstream but the
// response never made it back. The UI has to present it as an estimate — quietly
// implying it is authoritative would be worse than showing nothing, because the
// user would trust it right up to the point a batch dies half-finished.
//
// Counters are keyed by LOCAL calendar date. Every free channel here documents a
// "daily" allowance without naming a timezone; local midnight is the closest
// honest guess and matches what a user sees on their own clock.

const KEY = "grok-studio-quota";
export const QUOTA_CHANGED_EVENT = "grok-quota-changed";

export type QuotaLedger = Record<string, Record<string, number>>;

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function loadLedger(): QuotaLedger {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as QuotaLedger;
  } catch {
    return {};
  }
}

// Drops every day except today. Without this the ledger grows without bound, and
// a user who has had the app open for a year would carry 365 dead keys around on
// every read.
export function pruneLedger(ledger: QuotaLedger, today = todayKey()): QuotaLedger {
  const out: QuotaLedger = {};
  for (const [provider, byDay] of Object.entries(ledger)) {
    if (byDay && typeof byDay === "object" && typeof byDay[today] === "number") {
      out[provider] = { [today]: byDay[today] };
    }
  }
  return out;
}

function saveLedger(ledger: QuotaLedger) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pruneLedger(ledger)));
  } catch {
    // A full or disabled localStorage must not break generation — losing the
    // tally is annoying, refusing to generate is worse.
    return;
  }
  window.dispatchEvent(new CustomEvent(QUOTA_CHANGED_EVENT));
}

export function usedToday(provider: ProviderId, ledger = loadLedger()): number {
  const value = ledger[provider]?.[todayKey()];
  return typeof value === "number" && value > 0 ? value : 0;
}

// Called after a generation succeeds, with the number of images actually
// returned — not the number requested. A provider that returns 2 of the 4 asked
// for has, as far as anyone can tell from the browser, charged for 2.
export function recordUsage(provider: ProviderId, count: number) {
  if (typeof window === "undefined" || count <= 0) return;
  const ledger = loadLedger();
  const today = todayKey();
  const byDay = ledger[provider] ?? {};
  ledger[provider] = { ...byDay, [today]: (byDay[today] ?? 0) + count };
  saveLedger(ledger);
}

export function resetUsage(provider: ProviderId) {
  const ledger = loadLedger();
  delete ledger[provider];
  saveLedger(ledger);
}

export function resetAllUsage() {
  const ledger: QuotaLedger = {};
  saveLedger(ledger);
}

// 0 / absent = "no cap configured", which is treated as unlimited rather than as
// zero-remaining. Users who never open the limit field must not find generation
// blocked by a default they did not set.
export function dailyLimit(settings: Settings, provider: ProviderId): number | null {
  const raw = settings.dailyLimits?.[provider];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

export type QuotaStatus = {
  provider: ProviderId;
  used: number;
  limit: number | null;
  /** null when no limit is configured (unlimited as far as this app knows). */
  remaining: number | null;
  exhausted: boolean;
  /** True once at or below 20% of the cap — the warning threshold from the design. */
  low: boolean;
};

export function quotaStatus(
  settings: Settings,
  provider: ProviderId,
  ledger = loadLedger(),
): QuotaStatus {
  const used = usedToday(provider, ledger);
  const limit = dailyLimit(settings, provider);
  if (limit === null) {
    return { provider, used, limit: null, remaining: null, exhausted: false, low: false };
  }
  const remaining = Math.max(0, limit - used);
  return {
    provider,
    used,
    limit,
    remaining,
    exhausted: remaining === 0,
    // Exhausted is its own state; `low` means "getting close", so it stops being
    // true once there is nothing left to warn about.
    low: remaining > 0 && remaining <= Math.max(1, Math.ceil(limit * 0.2)),
  };
}

export function allQuotaStatuses(settings: Settings): QuotaStatus[] {
  const ledger = loadLedger();
  return PROVIDERS.map((provider) => quotaStatus(settings, provider.id, ledger));
}
