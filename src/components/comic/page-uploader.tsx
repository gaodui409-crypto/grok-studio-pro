import { useRef, useState } from "react";
import {
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Plus,
  FolderArchive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { fileToDataUri } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ComicPageItem } from "@/lib/app-store";
import {
  ARCHIVE_EXTENSIONS,
  countArchivePages,
  type ImportedPage,
  isArchiveName,
  isImageName,
  readArchivePages,
  relativePathOf,
  sortPickedFiles,
} from "@/lib/comic-import";

/**
 * Ceiling on pages held at once.
 *
 * Was 30, which a single chapter exceeds — a CBZ import that truncated at 30
 * would be useless for the format it exists to open. 200 covers a typical volume.
 *
 * ponytail: the real limit is memory, not this number. Pages are held as data
 * URIs in a zustand store (~1.4MB of string per 1MB image), so 200 large scans is
 * roughly 300-400MB of tab. The upgrade path is object URLs backed by the blobs
 * this importer already produces, which would drop the base64 overhead and let
 * the browser page them out; that is a bigger change than raising a constant.
 */
export const MAX_PAGES = 200;

/** Sort by name so a `page-01 … page-12` selection lands in reading order. */
const byName = (a: File, b: File) =>
  relativePathOf(a).localeCompare(relativePathOf(b), "zh-Hans-CN", { numeric: true });

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
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  /** True while an unpack is in flight. Unzipping a volume is seconds, not milliseconds. */
  const [busy, setBusy] = useState(false);
  const room = MAX_PAGES - pages.length;
  const full = room <= 0;
  /** Anything that should block adding pages: a batch is running, or an import is mid-flight. */
  const locked = disabled || busy;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files);
    const archives = picked.filter((f) => isArchiveName(f.name)).sort(byName);
    // Matched on the name as well as the MIME type: a folder pick hands us files
    // whose `type` is frequently empty, and those are exactly the scans we are
    // here to import.
    const images = sortPickedFiles(
      picked.filter((f) => isImageName(f.name) || f.type.startsWith("image/")),
    );
    if (!archives.length && !images.length) {
      return toast.error("没有可导入的文件（支持 JPG / PNG / WebP，或 ZIP / CBZ）");
    }

    setBusy(true);
    try {
      const collected: ImportedPage[] = [];
      // Every page the selection *held*, so the cap warning can say what it left
      // out rather than just showing fewer pages than were dropped.
      let found = images.length;

      // Loose images first, then each archive in name order. Both are internally
      // in reading order; mixing the two in one drop is rare enough that a stable
      // rule beats trying to interleave them by name.
      for (const file of images) {
        if (collected.length >= room) break;
        collected.push({ name: file.name, blob: file });
      }

      for (const archive of archives) {
        const remaining = room - collected.length;
        let unpacked: ImportedPage[];
        try {
          unpacked = await readArchivePages(archive, remaining);
        } catch {
          toast.error(`${archive.name} 解压失败，可能不是有效的 ZIP / CBZ`);
          continue;
        }
        // Counted only when the read came back saturated, which is the one case
        // where pages were left behind. Counting unconditionally would re-parse
        // every archive for a number nobody reads.
        found += unpacked.length === remaining ? await countArchivePages(archive) : unpacked.length;
        if (!unpacked.length && remaining > 0) toast.warning(`${archive.name} 里没有图片`);
        collected.push(...unpacked);
      }

      if (!collected.length) {
        if (found > 0) toast.warning(`已满 ${MAX_PAGES} 张，请先清空或移除几页`);
        return;
      }

      const uris = await Promise.all(collected.map((p) => fileToDataUri(p.blob)));
      const stamp = Date.now();
      onChange([
        ...pages,
        ...collected.map((p, i) => ({
          id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          name: p.name,
          src: uris[i],
          status: "pending" as const,
        })),
      ]);

      if (found > collected.length) {
        toast.warning(`共 ${found} 页，超出 ${MAX_PAGES} 张上限，已导入前 ${collected.length} 页`);
      } else if (archives.length) {
        // Only for archives: a loose multi-select appears in the filmstrip at
        // once and never needed confirming, whereas an unpack takes seconds and
        // this is what says it finished.
        toast.success(`已导入 ${collected.length} 页`);
      }
    } finally {
      setBusy(false);
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
        <div className="flex items-center gap-1">
          {/* Both entry points sit in the header rather than inside the drop zone,
              because the drop zone disappears once pages are in and importing a
              second volume is a normal thing to do. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={full || locked}
            onClick={() => folderRef.current?.click()}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {busy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <FolderArchive className="mr-1 h-3 w-3" aria-hidden />
            )}
            选择文件夹
          </Button>
          {pages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onChange([])}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" aria-hidden /> 清空
            </Button>
          )}
        </div>
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
          disabled={locked}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!locked) void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/70 bg-surface/50 px-4 py-7 text-center transition hover:border-primary/60 hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            drag && "border-primary bg-accent/30",
            locked && "cursor-not-allowed opacity-60 hover:border-border/70",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
          <span className="text-sm text-muted-foreground">
            {busy ? "正在解压…" : "点击或拖拽上传漫画页"}
          </span>
          <span className="text-xs text-muted-foreground/70">
            图片或 ZIP / CBZ 压缩包 · 最多 {MAX_PAGES} 张 · 按文件名排序
          </span>
        </button>
      )}
      {/* accept lists the archive extensions alongside image/*: without them the
          picker filters out the .cbz the user came to open, and the format is the
          reason this importer exists. */}
      <input
        ref={inputRef}
        type="file"
        accept={`image/*,${ARCHIVE_EXTENSIONS.join(",")}`}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Without this, re-picking the same file after removing it is a no-op:
          // the value has not changed, so no change event fires.
          e.target.value = "";
        }}
      />
      {/* A second input, because `webkitdirectory` is a property of the element and
          not of the click: one input cannot offer both a file and a folder dialog.
          The attributes are spread rather than written inline — React's JSX types
          do not declare them, though every browser that supports folder picking
          reads them. */}
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => {
          void handleFiles(e.target.files);
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
            if (!full && !locked) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!full && !locked) void handleFiles(e.dataTransfer.files);
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
                  disabled={i === 0 || locked}
                  onClick={() => move(i, -1)}
                  className="rounded bg-background/85 p-1 hover:bg-background disabled:opacity-40"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`把第 ${i + 1} 页后移`}
                  disabled={i === pages.length - 1 || locked}
                  onClick={() => move(i, 1)}
                  className="rounded bg-background/85 p-1 hover:bg-background disabled:opacity-40"
                >
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`移除第 ${i + 1} 页`}
                  // locked, not disabled: removing a page mid-unpack would be
                  // undone by the append that is already in flight.
                  disabled={locked}
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
              disabled={full || locked}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex h-[146px] w-[92px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/70 text-muted-foreground transition hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                (full || locked) && "cursor-not-allowed opacity-50 hover:border-border/70",
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              <span className="text-[11px]">
                {busy ? "解压中" : full ? `已满 ${MAX_PAGES}` : "添加"}
              </span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
