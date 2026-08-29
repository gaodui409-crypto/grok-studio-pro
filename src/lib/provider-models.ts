// Fetching model lists from the providers that publish one.
//
// Only three of the eight channels can do this, all without auth and all with
// permissive CORS: Gitee AI, Pollinations and AI Horde. ModelScope is a dead end
// — its /v1/models returns only LLM and audio models (Z-Image-Turbo is absent,
// and ?task=text-to-image has no effect), so it keeps the hand-written catalog.
//
// Fetched lists are MERGED with the curated catalog, never substituted for it.
// Pollinations is the reason: its /models returns just ["sana"] while `flux` is
// the documented default, so replacing would silently delete a working model
// from the user's dropdown.

import { catalogModels, type ModelSpec } from "./provider-catalog.ts";
import type { ProviderId } from "./settings.ts";
import type { FetchLike } from "./http.ts";

export const MODEL_LIST_PROVIDERS: ProviderId[] = ["gitee", "pollinations", "aihorde"];

export function supportsModelListing(provider: ProviderId): boolean {
  return MODEL_LIST_PROVIDERS.includes(provider);
}

const CACHE_KEY = "grok-studio-provider-models";

// Gitee's /v1/models mixes LLM, audio, video and image models with no task
// field to filter on, so the id has to carry the signal.
// ponytail: substring heuristic — a new image model with an unfamiliar name will
// be missed until its pattern is added. The curated catalog is the source of
// truth; this only supplements it, so a miss costs a dropdown entry, not a
// broken request.
const IMAGE_ID_PATTERN = /image|flux|sdxl|diffusion|kolors|krea|ideogram|majic|z-image|qwen-image/i;
const NON_IMAGE_ID_PATTERN = /video|audio|speech|tts|whisper|embed|rerank|chat|instruct|vl\b/i;

function looksLikeImageModel(id: string): boolean {
  return IMAGE_ID_PATTERN.test(id) && !NON_IMAGE_ID_PATTERN.test(id);
}

async function fetchJson<T>(url: string, fetchImpl: FetchLike, signal?: AbortSignal): Promise<T> {
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`模型列表请求失败：HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchGitee(fetchImpl: FetchLike, signal?: AbortSignal): Promise<ModelSpec[]> {
  const payload = await fetchJson<{ data?: { id?: string }[] }>(
    "https://ai.gitee.com/v1/models",
    fetchImpl,
    signal,
  );
  return (payload.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && looksLikeImageModel(id))
    .map((id) => ({ id, label: id, maxEdge: 2048 }));
}

async function fetchPollinations(fetchImpl: FetchLike, signal?: AbortSignal): Promise<ModelSpec[]> {
  const payload = await fetchJson<unknown>(
    "https://image.pollinations.ai/models",
    fetchImpl,
    signal,
  );
  // Documented as a bare string array; tolerate objects in case that changes.
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) =>
      typeof entry === "string" ? entry : ((entry as { name?: string })?.name ?? ""),
    )
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, label: id }));
}

async function fetchAiHorde(fetchImpl: FetchLike, signal?: AbortSignal): Promise<ModelSpec[]> {
  const payload = await fetchJson<{ name?: string; count?: number }[]>(
    "https://aihorde.net/api/v2/status/models?type=image",
    fetchImpl,
    signal,
  );
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((entry) => typeof entry.name === "string" && entry.name)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .map((entry) => ({
      id: entry.name as string,
      // Worker count is the useful signal here: a model with 0 workers online
      // will queue forever, so surface it in the label.
      label: entry.count ? `${entry.name}（${entry.count} 台）` : (entry.name as string),
    }));
}

/** Fetch the live model list for one provider. Throws if it has no endpoint. */
export async function fetchProviderModels(
  provider: ProviderId,
  options: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<ModelSpec[]> {
  const fetchImpl = options.fetch ?? fetch;
  if (provider === "gitee") return fetchGitee(fetchImpl, options.signal);
  if (provider === "pollinations") return fetchPollinations(fetchImpl, options.signal);
  if (provider === "aihorde") return fetchAiHorde(fetchImpl, options.signal);
  throw new Error(`该渠道没有可用的模型列表接口：${provider}`);
}

/** Curated entries first (they carry maxEdge/steps), then fetched extras. */
export function mergeModels(curated: ModelSpec[], fetched: ModelSpec[]): ModelSpec[] {
  const seen = new Set(curated.map((model) => model.id));
  return [...curated, ...fetched.filter((model) => !seen.has(model.id))];
}

type ModelCache = Partial<Record<ProviderId, { at: number; models: ModelSpec[] }>>;

function readCache(): ModelCache {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as ModelCache;
  } catch {
    return {};
  }
}

export function cachedModels(provider: ProviderId): ModelSpec[] {
  return readCache()[provider]?.models ?? [];
}

export function cacheModels(provider: ProviderId, models: ModelSpec[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const cache = readCache();
    cache[provider] = { at: Date.now(), models };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A full or unavailable localStorage must not break model selection —
    // the dropdown still works from the curated catalog.
  }
}

/** What the dropdown should show: curated catalog plus anything cached. */
export function availableModels(provider: ProviderId): ModelSpec[] {
  return mergeModels(catalogModels(provider), cachedModels(provider));
}

/** Fetch, merge, cache, return. Used by the refresh button. */
export async function refreshProviderModels(
  provider: ProviderId,
  options: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<ModelSpec[]> {
  const fetched = await fetchProviderModels(provider, options);
  cacheModels(provider, fetched);
  return mergeModels(catalogModels(provider), fetched);
}
