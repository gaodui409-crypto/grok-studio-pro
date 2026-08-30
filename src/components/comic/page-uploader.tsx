import { useRef, useState } from "react";
import { Upload, X, ArrowLeft, ArrowRight, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fileToDataUri } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ComicPageItem } from "@/lib/app-store";

export const MAX_PAGES = 30;

/** Sort by name so a `page-01 … page-12` selection lands in reading order. */
const byName = (a: File, b: File) => a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true });

export function PageUploader({
  pages,
  onChange,
  disabled,
}: {
  pages: ComicPageItem[];
  onChange: (p: ComicPageItem[]) => void;
  /** True while a batch runs: reordering or removing pages mid-flight would desync the queue. */
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const room = MAX_PAGES - pages.length;
  const full = room <= 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .sort(byName);
    if (!images.length) return toast.error("请选择图片文件（JPG / PNG / WebP）");
    // A cap, not a silent truncation: dropping a 200-page volume would hold 200
    // data URIs in memory at once and read as "it lost my pages" if we said nothing.
    const accepted = images.slice(0, room);
    const uris = await Promise.all(accepted.map(fileToDataUri));
    onChange([
      ...pages,
      ...accepted.map((f, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        src: uris[i],
        status: "pending" as const,
      })),
    ]);
    if (images.length > accepted.length) {
      toast.warning(`最多 ${MAX_PAGES} 张，已添加前 ${accepted.length} 张`);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          漫画页
          <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
            {pages.length}/{MAX_PAGES}
          </span>
        </h2>
        {pages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([])}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" aria-hidden /> 清空
          </Button>
        )}
      </div>

      {/* The full-size zone only while there is nothing to show. Once pages are in,
          the queue below is what the user is here to read, and a 120px dashed box
          asking for more uploads was pushing it off the fold. Dropping still works
          anywhere on the filmstrip — see the wrapper's handlers below.

          A real button, not a div with onClick: as a div it had no role, no
          accessible name and no tab stop, so upload was mouse-only. The file input
          is a sibling rather than a child — an <input> inside a <button> is invalid,
          and clicking would have double-fired. */}
      {pages.length === 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!disabled) void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/70 bg-surface/50 px-4 py-7 text-center transition hover:border-primary/60 hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            drag && "border-primary bg-accent/30",
            disabled && "cursor-not-allowed opacity-60 hover:border-border/70",
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">点击或拖拽上传漫画页</span>
          <span className="text-xs text-muted-foreground/70">
            支持 JPG / PNG / WebP · 最多 {MAX_PAGES} 张 · 按文件名排序
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Without this, re-picking the same file after removing it is a no-op:
          // the value has not changed, so no change event fires.
          e.target.value = "";
        }}
      />

      {pages.length > 0 && (
        <ul
          className={cn(
            "flex snap-x gap-2 overflow-x-auto rounded-xl pb-2 transition",
            drag && "bg-accent/20 ring-1 ring-primary",
          )}
          // Drop anywhere along the strip, not just on the small trailing tile.
          onDragOver={(e) => {
            e.preventDefault();
            if (!full && !disabled) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!full && !disabled) void handleFiles(e.dataTransfer.files);
          }}
        >
          {pages.map((p, i) => (
            <li
              key={p.id}
              className="group relative w-[92px] shrink-0 snap-start overflow-hidden rounded-lg border border-border/60 bg-surface/60"
            >
              {/* object-contain: these thumbnails exist to confirm *which* page is
                  at position N, and a square crop of a tall comic page can hide
                  exactly the panel that tells it apart from its neighbours. */}
              <img
                src={p.src}
                alt={`第 ${i + 1} 页：${p.name}`}
                className="h-[120px] w-full bg-background/40 object-contain"
              />
              <span className="absolute left-1 top-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {i + 1}
              </span>
              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  aria-label={`把第 ${i + 1} 页前移`}
                  disabled={i === 0 || disabled}
                  onClick={() => move(i, -1)}
                  className="rounded bg-background/85 p-1 hover:bg-background disabled:opacity-40"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`把第 ${i + 1} 页后移`}
                  disabled={i === pages.length - 1 || disabled}
                  onClick={() => move(i, 1)}
                  className="rounded bg-background/85 p-1 hover:bg-background disabled:opacity-40"
                >
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`移除第 ${i + 1} 页`}
                  disabled={disabled}
                  onClick={() => onChange(pages.filter((x) => x.id !== p.id))}
                  className="rounded bg-background/85 p-1 hover:bg-destructive/80 disabled:opacity-40"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
              <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground" title={p.name}>
                {p.name}
              </p>
            </li>
          ))}
          <li className="shrink-0">
            <button
              type="button"
              disabled={full || disabled}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex h-[146px] w-[92px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/70 text-muted-foreground transition hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                (full || disabled) && "cursor-not-allowed opacity-50 hover:border-border/70",
              )}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="text-[11px]">{full ? `已满 ${MAX_PAGES}` : "添加"}</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
