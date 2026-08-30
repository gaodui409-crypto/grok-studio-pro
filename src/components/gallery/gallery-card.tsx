import { Trash2, Download, Copy, Maximize2, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, type GalleryMeta } from "@/lib/gallery-db";
import { kindOf } from "@/lib/gallery-filter";
import { cn } from "@/lib/utils";

export function GalleryCard({
  item,
  url,
  selected,
  onToggleSelect,
  onPreview,
  onCopyPrompt,
  onDownload,
  onDelete,
}: {
  item: GalleryMeta;
  url?: string;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onCopyPrompt: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const kind = kindOf(item);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition",
        selected ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        aria-label={selected ? "取消选择" : "选择"}
        // The unselected box stays visible rather than appearing on hover:
        // hidden until hover means nothing tells you the cards are selectable,
        // and on touch there is no hover at all.
        className={cn(
          "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition",
          selected
            ? "border-primary bg-gradient-primary text-primary-foreground"
            : "border-white/40 bg-background/70 text-white/50 backdrop-blur hover:border-white/70 hover:text-white",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      {kind === "video" && (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] backdrop-blur">
          VIDEO{item.duration ? ` · ${item.duration}s` : ""}
        </span>
      )}

      {url ? (
        kind === "video" ? (
          <button
            type="button"
            onClick={onPreview}
            aria-label="播放预览"
            className="relative block aspect-square w-full bg-black"
          >
            <video
              src={url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 shadow-glow">
                <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
              </span>
            </span>
          </button>
        ) : (
          <img
            src={url}
            alt={item.prompt}
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
        )
      ) : (
        <div className="aspect-square w-full animate-pulse bg-surface" />
      )}

      <div className="space-y-1 p-2 text-[11px]">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="truncate">{item.sceneName || "—"}</span>
          <span className="shrink-0 font-mono">{formatBytes(item.size)}</span>
        </div>
        {item.provider && (
          <div className="inline-flex max-w-full rounded-full border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <span className="truncate">{item.provider}</span>
          </div>
        )}
        <p className="line-clamp-2 text-foreground/80">{item.prompt}</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-background/95 to-transparent p-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={onPreview}
          aria-label="放大预览"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={onCopyPrompt}
          aria-label="复制提示词"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={onDownload}
          aria-label="下载"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7 text-destructive"
          onClick={onDelete}
          aria-label="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
