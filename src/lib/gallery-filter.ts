import type { GalleryMeta } from "./gallery-db.ts";

export type GalleryKind = "image" | "video";
export type TimeRange = "all" | "today" | "7d" | "30d";
export type SortOrder = "newest" | "oldest" | "largest";

export type GalleryFilter = {
  kind: GalleryKind | "all";
  scene: string | "all";
  character: string | "all";
  provider: string | "all";
  time: TimeRange;
  search: string;
};

export const emptyFilter: GalleryFilter = {
  kind: "all",
  scene: "all",
  character: "all",
  provider: "all",
  time: "all",
  search: "",
};

// Older records predate the `type` field, so fall back to the MIME type rather
// than defaulting to "image" and mislabelling saved videos.
export function kindOf(item: GalleryMeta): GalleryKind {
  return item.type ?? (item.mimeType?.startsWith("video/") ? "video" : "image");
}

// Rolling windows, not calendar periods. "This week" would have to pick a start
// day (Monday? Sunday?) and "this month" makes the 1st show almost nothing, so
// the labels in the UI say 近 7 天 / 近 30 天 to match what this actually does.
// "today" stays calendar-based from local midnight, which is what people mean.
export function timeCutoff(range: TimeRange, now: Date = new Date()): number | null {
  if (range === "all") return null;
  if (range === "today") {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return midnight.getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function matchesFilter(
  item: GalleryMeta,
  filter: GalleryFilter,
  now: Date = new Date(),
): boolean {
  if (filter.kind !== "all" && kindOf(item) !== filter.kind) return false;
  if (filter.scene !== "all" && item.sceneName !== filter.scene) return false;
  if (filter.character !== "all" && item.character !== filter.character) return false;
  if (filter.provider !== "all" && item.provider !== filter.provider) return false;

  const cutoff = timeCutoff(filter.time, now);
  if (cutoff !== null && item.createdAt < cutoff) return false;

  const term = filter.search.trim().toLowerCase();
  if (term) {
    // Search covers the fields a user would actually recall: what they typed, and
    // the scene/character labels they organised by.
    const haystack = [item.prompt, item.sceneName, item.character, item.outfit, item.action]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
}

export function sortItems(items: GalleryMeta[], order: SortOrder): GalleryMeta[] {
  const copy = [...items];
  if (order === "oldest") return copy.sort((a, b) => a.createdAt - b.createdAt);
  if (order === "largest") return copy.sort((a, b) => b.size - a.size);
  return copy.sort((a, b) => b.createdAt - a.createdAt);
}

export function applyFilter(
  items: GalleryMeta[],
  filter: GalleryFilter,
  order: SortOrder = "newest",
  now: Date = new Date(),
): GalleryMeta[] {
  return sortItems(
    items.filter((item) => matchesFilter(item, filter, now)),
    order,
  );
}

export type FacetOption = { value: string; count: number };

// Counts for one facet, computed with that facet's own selection removed —
// otherwise selecting one scene would report every other scene as 0, and the
// sidebar would look broken instead of navigable.
function facetCounts(
  items: GalleryMeta[],
  filter: GalleryFilter,
  key: keyof GalleryFilter,
  valueOf: (item: GalleryMeta) => string | undefined,
  now: Date,
): FacetOption[] {
  const relaxed: GalleryFilter = { ...filter, [key]: "all" };
  const tally = new Map<string, number>();
  for (const item of items) {
    if (!matchesFilter(item, relaxed, now)) continue;
    const value = valueOf(item);
    if (!value) continue;
    tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "zh"));
}

export type GalleryFacets = {
  total: number;
  kinds: { image: number; video: number };
  scenes: FacetOption[];
  characters: FacetOption[];
  providers: FacetOption[];
};

export function computeFacets(
  items: GalleryMeta[],
  filter: GalleryFilter,
  now: Date = new Date(),
): GalleryFacets {
  const kindRelaxed: GalleryFilter = { ...filter, kind: "all" };
  const forKinds = items.filter((item) => matchesFilter(item, kindRelaxed, now));
  return {
    total: items.filter((item) => matchesFilter(item, filter, now)).length,
    kinds: {
      image: forKinds.filter((item) => kindOf(item) === "image").length,
      video: forKinds.filter((item) => kindOf(item) === "video").length,
    },
    scenes: facetCounts(items, filter, "scene", (item) => item.sceneName, now),
    characters: facetCounts(items, filter, "character", (item) => item.character, now),
    providers: facetCounts(items, filter, "provider", (item) => item.provider, now),
  };
}

// True when anything is narrowing the view — drives whether a "clear filters"
// affordance is worth showing.
export function isFiltered(filter: GalleryFilter): boolean {
  return (
    filter.kind !== "all" ||
    filter.scene !== "all" ||
    filter.character !== "all" ||
    filter.provider !== "all" ||
    filter.time !== "all" ||
    filter.search.trim() !== ""
  );
}
