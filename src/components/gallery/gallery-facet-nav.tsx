import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytesPair } from "@/lib/gallery-db";
import type { GalleryFacets, GalleryFilter, TimeRange } from "@/lib/gallery-filter";
import type { StorageEstimate } from "@/hooks/use-gallery-items";

// Labels say 近 7 天 / 近 30 天 rather than 本周 / 本月 because the cutoffs are
// rolling windows — see the comment on timeCutoff.
const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "all", label: "全部" },
];

function FacetRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
        active
          ? "bg-gradient-primary font-medium text-primary-foreground shadow-glow"
          : "text-muted-foreground hover:bg-surface hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className={cn("shrink-0 font-mono text-xs", active && "text-primary-foreground/80")}>
          {count}
        </span>
      )}
    </button>
  );
}

function FacetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-3 py-4 last:border-b-0">
      <h2 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function GalleryFacetNav({
  facets,
  filter,
  onChange,
  storage,
  selectedCount,
  onClearSelection,
}: {
  facets: GalleryFacets;
  filter: GalleryFilter;
  onChange: (patch: Partial<GalleryFilter>) => void;
  storage: StorageEstimate | null;
  selectedCount: number;
  onClearSelection: () => void;
}) {
  const totalKinds = facets.kinds.image + facets.kinds.video;

  return (
    <nav
      aria-label="画廊筛选"
      className="flex w-[236px] shrink-0 flex-col border-r border-border/60 bg-card/40"
    >
      <div className="flex-1 overflow-y-auto">
        <FacetSection title="类型">
          <FacetRow
            label="全部"
            count={totalKinds}
            active={filter.kind === "all"}
            onClick={() => onChange({ kind: "all" })}
          />
          <FacetRow
            label="图片"
            count={facets.kinds.image}
            active={filter.kind === "image"}
            onClick={() => onChange({ kind: "image" })}
          />
          <FacetRow
            label="视频"
            count={facets.kinds.video}
            active={filter.kind === "video"}
            onClick={() => onChange({ kind: "video" })}
          />
        </FacetSection>

        {facets.scenes.length > 0 && (
          <FacetSection title="场景">
            {filter.scene !== "all" && (
              <FacetRow
                label="全部场景"
                active={false}
                onClick={() => onChange({ scene: "all" })}
              />
            )}
            {facets.scenes.map((option) => (
              <FacetRow
                key={option.value}
                label={option.value}
                count={option.count}
                active={filter.scene === option.value}
                onClick={() =>
                  onChange({ scene: filter.scene === option.value ? "all" : option.value })
                }
              />
            ))}
          </FacetSection>
        )}

        {facets.characters.length > 0 && (
          <FacetSection title="角色">
            {filter.character !== "all" && (
              <FacetRow
                label="全部角色"
                active={false}
                onClick={() => onChange({ character: "all" })}
              />
            )}
            {facets.characters.map((option) => (
              <FacetRow
                key={option.value}
                label={option.value}
                count={option.count}
                active={filter.character === option.value}
                onClick={() =>
                  onChange({ character: filter.character === option.value ? "all" : option.value })
                }
              />
            ))}
          </FacetSection>
        )}

        {facets.providers.length > 0 && (
          <FacetSection title="渠道">
            {filter.provider !== "all" && (
              <FacetRow
                label="全部渠道"
                active={false}
                onClick={() => onChange({ provider: "all" })}
              />
            )}
            {facets.providers.map((option) => (
              <FacetRow
                key={option.value}
                label={option.value}
                count={option.count}
                active={filter.provider === option.value}
                onClick={() =>
                  onChange({ provider: filter.provider === option.value ? "all" : option.value })
                }
              />
            ))}
          </FacetSection>
        )}

        <FacetSection title="时间">
          {TIME_OPTIONS.map((option) => (
            <FacetRow
              key={option.value}
              label={option.label}
              active={filter.time === option.value}
              onClick={() => onChange({ time: option.value })}
            />
          ))}
        </FacetSection>
      </div>

      <div className="space-y-3 border-t border-border/60 p-3">
        {selectedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
            <span>已选 {selectedCount} 项</span>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-primary-glow hover:underline"
            >
              <X className="h-3 w-3" /> 清空
            </button>
          </div>
        )}
        {storage && storage.quota > 0 && (
          <div className="px-1 text-[11px] text-muted-foreground">
            <div className="mb-1 flex items-center justify-between">
              <span>存储用量</span>
              <span className="font-mono">{formatBytesPair(storage.usage, storage.quota)}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-gradient-primary"
                style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
