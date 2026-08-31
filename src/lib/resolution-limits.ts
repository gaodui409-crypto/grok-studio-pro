// Which resolution tiers a provider+model can actually deliver.
//
// Until now every tier was offered on every channel and the request path quietly
// fixed up whatever could not be served: aspectToWH() clamps the long edge to the
// model's maxEdge, and xAI/PixAI map the tier onto the nearest one their API
// accepts. Both are correct as a last line of defence and both are invisible —
// picking 2k on Z-Image-Turbo produced a 1664px image with nothing on screen
// saying so, which reads as the model ignoring you rather than as a documented
// ceiling.
//
// Two different shapes of limit end up here:
//
//  1. A CEILING on the long edge (`maxEdge` from the model catalog, or a protocol
//     cap like PixAI web's 1536). Tiers above it are silently reduced — the case
//     that matters, so those get disabled.
//  2. An ALLOWLIST of tier names, for the two channels whose API takes a tier
//     rather than pixel dimensions (xAI: 1k/2k, PixAI official: 1k/1.5k). Tiers
//     under the floor round *up*, which costs nothing the user asked for, so
//     those stay selectable and are annotated instead of disabled.

import { findModelSpec } from "./provider-catalog.ts";
import {
  PROVIDER_MODEL_FIELD,
  RESOLUTION_TIERS,
  tierEdge,
  type ProviderId,
  type ResolutionTier,
  type Settings,
} from "./settings.ts";

/**
 * Channels that take a tier *name* over the wire, with the set they accept.
 *
 * Kept here rather than in each adapter so the picker and the request path read
 * the same table — the adapters import from this module. Anything absent takes
 * pixel dimensions and is governed by the ceiling instead.
 */
export const PROVIDER_TIER_ALLOWLIST: Partial<Record<ProviderId, readonly ResolutionTier[]>> = {
  xai: ["1k", "2k"],
  pixai: ["1k", "1.5k"],
};

/**
 * Hard protocol ceilings that belong to the channel, not to any one model.
 *
 * PixAI's web GraphQL path maxes out at 1536 whatever model is named. Channels
 * driven by the model catalog (Gitee, ModelScope, AI Horde) are absent: their
 * ceiling is per-model and comes from `maxEdge`.
 */
export const PROVIDER_MAX_EDGE: Partial<Record<ProviderId, number>> = {
  "pixai-web": 1536,
};

export type TierAvailability = {
  id: ResolutionTier;
  label: string;
  edge: number;
  /** False when choosing it would silently produce a smaller image. */
  enabled: boolean;
  /** What the channel would actually deliver, when that differs from `edge`. */
  note?: string;
};

export type ResolutionLimit = {
  /** Long-edge ceiling in pixels, or null when nothing here knows of one. */
  maxEdge: number | null;
  /** Where the ceiling came from, for the hint under the control. */
  source: "model" | "provider" | null;
  /** Model id the ceiling was read from, when source is "model". */
  modelId?: string;
  tiers: TierAvailability[];
  /** Highest tier that can actually be delivered. */
  highest: ResolutionTier;
};

/** The model id currently selected for `provider`, from settings. */
export function currentModelId(settings: Settings, provider: ProviderId): string {
  const field = PROVIDER_MODEL_FIELD[provider];
  return field ? String(settings[field] ?? "") : "";
}

/**
 * What `provider` + `modelId` can deliver.
 *
 * A model that is not in the catalog (a live-fetched Gitee id, an AI Horde
 * community model, anything typed by hand) yields no ceiling rather than a
 * guessed one: disabling a tier that would have worked is worse than letting the
 * request path clamp it, because the user cannot argue with a greyed-out option.
 */
export function resolutionLimit(provider: ProviderId, modelId: string): ResolutionLimit {
  const allowlist = PROVIDER_TIER_ALLOWLIST[provider];
  const providerCap = PROVIDER_MAX_EDGE[provider];
  const modelCap = findModelSpec(provider, modelId)?.maxEdge;

  // Allowlisted channels: the ceiling is the largest tier they accept. Their API
  // never sees a pixel count, so a model-level maxEdge cannot apply.
  const allowlistCap = allowlist?.length
    ? Math.max(...allowlist.map((tier) => tierEdge(tier)))
    : undefined;

  // Most restrictive wins. Provider protocol caps and model caps can coexist
  // (a 2048 model on a 1536 protocol is capped at 1536).
  const candidates: { edge: number; source: "model" | "provider" }[] = [];
  if (allowlistCap !== undefined) candidates.push({ edge: allowlistCap, source: "provider" });
  if (providerCap !== undefined) candidates.push({ edge: providerCap, source: "provider" });
  if (modelCap !== undefined) candidates.push({ edge: modelCap, source: "model" });

  const winner = candidates.reduce<{ edge: number; source: "model" | "provider" } | null>(
    (best, candidate) => (best === null || candidate.edge < best.edge ? candidate : best),
    null,
  );

  const maxEdge = winner?.edge ?? null;
  const floor = allowlist?.length ? Math.min(...allowlist.map((tier) => tierEdge(tier))) : null;

  const tiers: TierAvailability[] = RESOLUTION_TIERS.map((tier) => {
    const overCeiling = maxEdge !== null && tier.edge > maxEdge;
    if (overCeiling) {
      return {
        id: tier.id,
        label: tier.label,
        edge: tier.edge,
        enabled: false,
        note: `超出上限 ${maxEdge}`,
      };
    }
    // Under an allowlist floor: selectable, but say what it becomes. Rounding up
    // gives more than was asked for, so blocking it would be the wrong trade.
    if (floor !== null && tier.edge < floor && !allowlist?.includes(tier.id)) {
      return {
        id: tier.id,
        label: tier.label,
        edge: tier.edge,
        enabled: true,
        note: `该渠道按 ${floor} 出图`,
      };
    }
    return { id: tier.id, label: tier.label, edge: tier.edge, enabled: true };
  });

  const enabled = tiers.filter((tier) => tier.enabled);
  const highest = (enabled[enabled.length - 1]?.id ?? RESOLUTION_TIERS[0].id) as ResolutionTier;

  return {
    maxEdge,
    source: winner?.source ?? null,
    modelId: winner?.source === "model" ? modelId : undefined,
    tiers,
    highest,
  };
}

/** Same, reading the provider and model out of settings. */
export function currentResolutionLimit(
  settings: Settings,
  provider: ProviderId = settings.provider,
): ResolutionLimit {
  return resolutionLimit(provider, currentModelId(settings, provider));
}

/**
 * A tier that is safe to submit, given a limit.
 *
 * Called when the selection is already above the ceiling — after switching to a
 * smaller model, say. Steps down to the highest deliverable tier instead of
 * jumping to a default, so 2k → 1.5k rather than 2k → 1k.
 */
export function clampTier(tier: ResolutionTier, limit: ResolutionLimit): ResolutionTier {
  const entry = limit.tiers.find((candidate) => candidate.id === tier);
  return entry?.enabled ? tier : limit.highest;
}
