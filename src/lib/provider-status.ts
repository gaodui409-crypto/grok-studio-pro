import {
  PROVIDERS,
  PROVIDER_FEATURES,
  fallbackProviders,
  providerSetupIssue,
  type ProviderId,
  type Settings,
} from "./settings.ts";

/**
 * Three states, because "配好了" and "能放心用" are not the same thing.
 *
 * - `ready`   — credentials present and safe to generate with.
 * - `limited` — usable, but with a caveat serious enough that the automatic
 *               fallback refuses to pick it (today: anonymous AI Horde, whose
 *               0 Kudos means lowest priority and a ~711px ceiling).
 * - `unset`   — missing credentials, or no generation support at all.
 */
export type ProviderStatus = "ready" | "limited" | "unset";

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  ready: "已配置",
  limited: "可用但受限",
  unset: "未配置",
};

export function providerStatus(settings: Settings, provider: ProviderId): ProviderStatus {
  if (providerSetupIssue(settings, provider) !== null) return "unset";
  if (!PROVIDER_FEATURES[provider].t2i) return "unset";
  return fallbackProviders(settings).includes(provider) ? "ready" : "limited";
}

/**
 * Splits "Gitee AI 模力方舟（免费）" into name + tag.
 *
 * PROVIDERS.label carries its qualifier inline so that plain text lists read
 * correctly, but the settings header wants the qualifier as a badge next to the
 * title. Deriving it here keeps one source of truth instead of a second table
 * that would drift out of sync.
 */
export function splitProviderLabel(label: string): { name: string; tag: string | null } {
  const match = label.match(/^(.*?)（(.+)）$/);
  if (!match) return { name: label, tag: null };
  return { name: match[1].trim(), tag: match[2].trim() };
}

export function providerMeta(provider: ProviderId) {
  return PROVIDERS.find((candidate) => candidate.id === provider);
}
