import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Rows3,
  Square,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { saveBlob } from "@/lib/download";
import { fetchBlobChecked } from "@/lib/http";
import { resultFileName } from "@/lib/comic-batch";
import {
  isFallback,
  openIndexFor,
  pageLabel,
  readerImage,
  resultCount,
  stepIndex,
  type ReadSide,
} from "@/lib/comic-reader";
import type { ComicPageItem } from "@/lib/app-store";

/** 单页 turns one page at a time; 连页 is the vertical scroll manga readers use. */
type ReadMode = "single" | "continuous";

/** A big, always-there page-turn target. Ghost so it never competes with the art. */
function ReaderArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === -1 ? "上一页" : "下一页"}
      // Disabled rather than hidden: a control that vanishes at the last page moves
      // the other one sideways, and the end of the book is worth being able to feel.
      className="flex h-24 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-25"
    >
      <Icon className="h-6 w-6" aria-hidden />
    </button>
  );
}

/**
 * One page, plus a note when it is showing the upload instead of a result.
 *
 * The note matters most in 连页: scrolling past a page that is still black and white
 * otherwise looks like the model declined to colour it, rather than like a request
 * that failed and can be retried from the queue.
 */
function PageFrame({
  page,
  index,
  side,
  continuous,
}: {
  page: ComicPageItem;
  index: number;
  side: ReadSide;
  continuous?: boolean;
}) {
  const fallback = isFallback(page, side);
  const showingResult = side === "result" && !fallback;
  return (
    <figure
      className={cn(
        "relative w-full",
        // A flex column that fills the bounded parent, so `flex-1 min-h-0` below has
        // something definite to shrink against. `max-h-full` on the image alone did
        // not work: it resolved against this figure's own auto height, so a 1000px
        // page simply overflowed and took its caption off-screen with it.
        continuous ? "mb-1" : "flex h-full flex-col items-center justify-center gap-1.5",
      )}
    >
      <img
        src={readerImage(page, side)}
        alt={`第 ${index + 1} 页：${page.name}${showingResult ? " 的生成结果" : " 原图"}`}
        className={cn(
          "mx-auto w-auto max-w-full rounded-lg border border-border/50 bg-surface/30 object-contain",
          // 单页 scales the page down to fit; 连页 leaves it at full width, where
          // scrolling is the point.
          !continuous && "min-h-0 flex-1",
        )}
      />
      {continuous && (
        <span className="absolute left-2 top-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {index + 1}
        </span>
      )}
      {fallback && (
        <figcaption
          className={cn(
            "flex shrink-0 items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground",
            continuous && "mt-1.5",
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0 text-warning" aria-hidden />
          {page.status === "failed"
            ? `这一页显示的是原图，生成失败：${page.error ?? "未知错误"}`
            : "这一页还没有生成结果，显示的是原图"}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Keep the header counter honest while scrolling in 连页 mode.
 *
 * Without this the counter would sit on whatever page the reader opened at, so it
 * would read 第 1 / 30 页 while you are looking at page 20 — and 下载这一页 beside it
 * would hand you page 1. The counter and the download button name the page you are
 * actually looking at, or they should not be there.
 *
 * `-45%` top and bottom shrinks the observation area to a band across the middle of
 * the viewport, so the page that owns the centre of the screen is the current one.
 * Querying the DOM for `[data-page]` rather than keeping a ref map: the pages are
 * already marked for this, and one selector is less state to get out of sync.
 */
function useVisiblePage(
  enabled: boolean,
  root: HTMLElement | null,
  count: number,
  onVisible: (index: number) => void,
) {
  useEffect(() => {
    if (!enabled || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.page);
          if (Number.isInteger(i)) onVisible(i);
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const el of root.querySelectorAll("[data-page]")) io.observe(el);
    return () => io.disconnect();
  }, [enabled, root, count, onVisible]);
}

/**
 * Read a batch as a comic: one page at a time, or as a continuous scroll.
 *
 * Replaces the single-page preview dialog. That dialog could show page 14 but had no
 * way to reach page 15, so reading a finished 30-page run meant opening and closing
 * thirty modals — the pages were all there and the app could not turn one.
 *
 * Every page is reachable, including the ones that failed or have not run: hiding
 * them would renumber the book mid-run, and flipping through the uploads to check
 * their order is worth doing *before* paying for thirty requests. A page with no
 * result shows the upload with a note saying so.
 */
export function ComicReader({
  pages,
  openId,
  onClose,
  suffix,
}: {
  pages: ComicPageItem[];
  /** Page to open at; `null` keeps the reader closed. */
  openId: string | null;
  onClose: () => void;
  /** File-name tag for the single-page download: "colored" / "translated". */
  suffix: string;
}) {
  const open = openId !== null;
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<ReadSide>("result");
  const [mode, setMode] = useState<ReadMode>("single");
  const [showText, setShowText] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);

  const total = pages.length;
  // Clamped rather than trusted: pages can be removed while the reader is open, and
  // an index left past the end would paint a blank frame.
  const safe = stepIndex(index, 0, total);
  const current = pages[safe];
  const done = resultCount(pages);

  useEffect(() => {
    if (openId !== null) setIndex(openIndexFor(pages, openId));
    // Only when the reader is asked to open. Re-running this as `pages` mutates during
    // a live batch would yank the reader back to the row that opened it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => stepIndex(i, delta, pages.length));
    },
    [pages.length],
  );

  useVisiblePage(open && mode === "continuous", scrollEl, total, setIndex);

  // Latest index without putting it in the scroll effect's deps: it has to be read
  // when the mode flips, but re-running on every index change would fight the user's
  // own scrolling, snapping them back a page at a time.
  const indexRef = useRef(safe);
  useEffect(() => {
    indexRef.current = safe;
  }, [safe]);

  useEffect(() => {
    if (mode !== "continuous" || !scrollEl) return;
    scrollEl.querySelector(`[data-page="${indexRef.current}"]`)?.scrollIntoView({ block: "start" });
  }, [mode, scrollEl]);

  /**
   * Page turning on the document, not on the dialog.
   *
   * It has to survive focus going anywhere, because the turn buttons disable at the
   * ends: clicking 下一页 up to the last page disables the very button holding focus,
   * the browser drops focus to <body>, and a handler bound to the dialog then never
   * sees another key. Paging to the end with the mouse killed the keyboard entirely.
   *
   * Radix traps focus while the dialog is open, so listening this wide is still scoped
   * to the reader — except for typing targets, which keep their own arrow keys: the
   * translation box below is selectable text, and paging the book while someone is
   * moving a cursor through it would be the wrong reading of the same keystroke.
   */
  useEffect(() => {
    if (!open || mode !== "single") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(total - 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode, go, total]);

  // Warm the next page so a turn paints immediately. Results are remote URLs, and
  // without this every 下一页 flashes an empty frame while the image downloads —
  // reading a batch of 30 means paying that wait 29 times.
  useEffect(() => {
    if (!open) return;
    const next = pages[safe + 1];
    if (!next) return;
    const img = new Image();
    img.src = readerImage(next, side);
  }, [open, pages, safe, side]);

  // Keep the current thumbnail in view, or the strip silently falls out of sync with
  // the page on screen once you page past the sixth or so with the keyboard.
  useEffect(() => {
    if (!open) return;
    const el = stripRef.current?.children[safe] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open, safe]);

  const download = async () => {
    if (!current?.resultUrl) return;
    try {
      const blob = await fetchBlobChecked(current.resultUrl);
      // Index-prefixed to match the zip's naming, so pages saved one at a time still
      // sort into reading order beside a batch download instead of by upload filename.
      saveBlob(
        blob,
        `${String(safe + 1).padStart(2, "0")}-${resultFileName(current.name, suffix)}`,
      );
    } catch (e) {
      toast.error(`下载失败：${(e as Error).message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        onClose();
        // Reading position is per-visit. Side and mode are preferences, so they stay.
        setShowText(false);
      }}
    >
      <DialogContent
        // h-[92vh] with the body scrolling inside, rather than the dialog growing:
        // a comic page is much taller than it is wide, and letting the dialog size to
        // its content put the page-turn buttons below the fold on every page.
        className="flex h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden border-border/60 bg-background p-0"
      >
        {/* pr-12 clears the dialog's own close button in the top-right corner. */}
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm">{current?.name ?? "阅读"}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {/* role=status so a screen reader hears the page change; the arrows move
                  focus nowhere, so nothing else would announce it. */}
              <span role="status" className="tabular-nums">
                {pageLabel(safe, total)}
              </span>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              {done} / {total} 页已生成
            </DialogDescription>
          </div>

          <div
            className="flex gap-1 rounded-lg border border-border/60 bg-surface/60 p-1"
            role="group"
            aria-label="切换阅读模式"
          >
            {(
              [
                ["single", "单页", Square],
                ["continuous", "连页", Rows3],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  mode === key
                    ? "bg-primary/15 text-primary-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden /> {label}
              </button>
            ))}
          </div>

          {/* Only when there is a result to compare against. On a batch that has not
              run, 结果 / 原图 would be two buttons showing the same image. */}
          {done > 0 && (
            <div
              className="flex gap-1 rounded-lg border border-border/60 bg-surface/60 p-1"
              role="group"
              aria-label="切换显示原图或结果"
            >
              {(
                [
                  ["result", "结果"],
                  ["original", "原图"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={side === key}
                  onClick={() => setSide(key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    side === key
                      ? "bg-primary/15 text-primary-glow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
          {mode === "single" ? (
            <div className="flex h-full items-center gap-2 px-2">
              <ReaderArrow dir={-1} disabled={safe === 0} onClick={() => go(-1)} />
              {/* No overflow here on purpose: in 单页 the page is meant to *fit*, so
                  it is scaled down to the space between header and strip rather than
                  scrolled. Letting it scroll is what pushed the bottom of the page —
                  and the 未生成 note under it — off the frame. */}
              <div className="flex h-full min-w-0 flex-1 items-center justify-center py-3">
                {current && <PageFrame page={current} index={safe} side={side} />}
              </div>
              <ReaderArrow dir={1} disabled={safe >= total - 1} onClick={() => go(1)} />
            </div>
          ) : (
            <div ref={setScrollEl} className="h-full overflow-y-auto px-4 pb-3 pt-4">
              {/* pt-4 with matching scroll-mt on each page: without it a page scrolled
                  to the top butts straight against the header, and the note belonging
                  to the page above bleeds through the seam mid-sentence.

                  No gap between the pages themselves, and each carries its own number:
                  a comic page is meant to butt against the next one. The strip below is
                  how you jump; this is how you read. */}
              <div className="mx-auto flex max-w-3xl flex-col">
                {pages.map((p, i) => (
                  <div key={p.id} data-page={i} className="scroll-mt-4">
                    <PageFrame page={p} index={i} side={side} continuous />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showText && current?.translation && (
          <div className="shrink-0 space-y-1.5 border-t border-border/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              第 {safe + 1} 页 · 识别原文 / 译文对照
            </p>
            <Textarea
              readOnly
              value={current.translation}
              aria-label={`第 ${safe + 1} 页识别原文与译文对照`}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>
        )}

        <footer className="flex shrink-0 items-center gap-3 border-t border-border/60 px-4 py-2.5">
          {/* The strip is the only way to get from page 2 to page 27 without 25
              clicks, so it takes the width and the buttons keep to the right. */}
          <ol
            ref={stripRef}
            aria-label="页面缩略图"
            className="flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto py-0.5"
          >
            {pages.map((p, i) => (
              <li key={p.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`跳到第 ${i + 1} 页`}
                  aria-current={i === safe ? "true" : undefined}
                  className={cn(
                    "relative block h-14 w-11 overflow-hidden rounded-md border bg-background/40 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    i === safe
                      ? "border-primary ring-1 ring-primary/40"
                      : "border-border/50 opacity-70 hover:opacity-100",
                  )}
                >
                  <img src={readerImage(p, side)} alt="" className="h-full w-full object-contain" />
                  <span className="absolute bottom-0 right-0 bg-background/85 px-1 text-[9px] font-medium tabular-nums">
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="flex shrink-0 items-center gap-1.5">
            {current?.translation && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={showText}
                onClick={() => setShowText((v) => !v)}
                className="h-8 text-xs"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {showText ? "收起译文" : "查看译文"}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!current?.resultUrl}
              onClick={() => void download()}
              className="h-8 text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 下载这一页
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
