import { PROVIDERS, type ProviderId } from "./settings.ts";

/**
 * What a batch of N images costs on a given channel.
 *
 * The batch page used to multiply every run by a flat $0.07 — xAI's Image Pro
 * price — no matter which channel was selected. Gitee's free daily 100 therefore
 * showed "$1.68" for a 24-image run, which is not a rounding error but a made-up
 * charge on a channel that cannot bill anyone. Worse, it read as authoritative and
 * would push someone to cut a batch they had every right to run.
 *
 * Only xAI (and NewAPI relays speaking its API) bills per image, so only xAI gets
 * a number. Everything else reports its own limit type and lets the channel's own
 * quota text in 设置 carry the detail — better a stated unknown than a confident
 * wrong figure.
 */
export type BatchCost =
  /** Billed per image; `usd` is the estimate for the whole batch. */
  | { kind: "paid"; usd: number; perImage: number }
  /** No money involved, but a daily or credit ceiling applies. */
  | { kind: "free" }
  /** The channel's allowance is not documented well enough to predict. */
  | { kind: "unknown" };

// xAI's two published image prices. A NewAPI relay can of course charge whatever
// it likes; this is the official rate and the closest thing to a real number.
const XAI_PRO_USD = 0.07;
const XAI_BASE_USD = 0.04;

export function perImageUsd(provider: ProviderId, model: string): number | null {
  if (provider !== "xai") return null;
  return /pro/i.test(model) ? XAI_PRO_USD : XAI_BASE_USD;
}

export function batchCost(provider: ProviderId, model: string, count: number): BatchCost {
  const perImage = perImageUsd(provider, model);
  if (perImage !== null) {
    return { kind: "paid", usd: perImage * count, perImage };
  }
  // pixai-pool has no integration at all, and the two PixAI key routes depend on
  // an account tier the app cannot see.
  if (provider === "pixai" || provider === "pixai-pool") return { kind: "unknown" };
  return { kind: "free" };
}

/** The channel's own allowance note, for showing next to a free batch. */
export function quotaNote(provider: ProviderId): string {
  return PROVIDERS.find((p) => p.id === provider)?.quota ?? "";
}
