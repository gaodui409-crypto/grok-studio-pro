import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Check, AlertTriangle, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ComicPageItem } from "@/lib/app-store";
import { batchStats, failedPages, formatDuration } from "@/lib/comic-batch";

/**
 * Live "已用 4.2s" for the row currently in flight.
 *
 * Its own component so the ticker re-renders one <span> instead of the whole queue.
 * `startedAt` is only ever set inside a click handler, so there is no server/client
 * clock to disagree about at hydration time.
 */
function RunningElapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [startedAt]);
  return <span className="tabular-nums">已用 {formatDuration(Math.max(0, now - startedAt))}</span>;
}

function StatusBadge({ page, index }: { page: ComicPageItem; index: number }) {
  if (page.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        <Check className="h-3 w-3" aria-hidden /> 已完成
      </span>
    );
  }
  if (page.status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-glow">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {page.step ?? `进行中 #${index + 1}`}
      </span>
    );
  }
  if (page.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden /> 失败
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
      等待中
    </span>
  );
}

export function BatchQueue({
  pages,
  running,
  concurrency,
  onPreview,
  onRetry,
  onRetryFailed,
  emptyHint,
}: {
  pages: ComicPageItem[];
  running: boolean;
  concurrency: number;
  onPreview: (p: ComicPageItem) => void;
  onRetry: (p: ComicPageItem) => void;
  onRetryFailed: () => void;
  emptyHint: string;
}) {
  const s = batchStats(pages);
  const failed = failedPages(pages);

  // Deliberately borderless. The upload zone directly above is already a dashed
  // box, and a second one under it read as two competing drop targets.
  if (!pages.length) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground/70">暂无任务</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label="批处理队列">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-tight">批处理队列</h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {s.settled} / {s.total} · 并发 {concurrency}
        </span>
      </div>

      {(running || s.settled > 0) && <Progress value={s.percent} aria-label="批处理进度" />}

      <ul className="space-y-2">
        {pages.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border/60 bg-surface/50 p-2.5 transition",
              p.status === "running" && "border-primary/40 bg-primary/[0.04]",
              p.status === "failed" && "border-destructive/30",
            )}
          >
            <img
              src={p.src}
              alt={`第 ${i + 1} 页原图`}
              className="h-14 w-11 shrink-0 rounded-md border border-border/50 bg-background/40 object-contain"
            />
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            {p.resultUrl ? (
              <button
                type="button"
                onClick={() => onPreview(p)}
                aria-label={`放大查看第 ${i + 1} 页结果`}
                className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-border/50 bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <img
                  src={p.resultUrl}
                  alt={`第 ${i + 1} 页结果`}
                  className="h-full w-full object-contain"
                />
              </button>
            ) : (
              <div
                className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-border/50 bg-background/20"
                aria-hidden
              >
                {p.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-glow" />
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">—</span>
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge page={p} index={i} />
                <span className="truncate text-xs text-muted-foreground">
                  第 {i + 1} 页 · {p.name}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
                {p.status === "running" && p.startedAt !== undefined ? (
                  <RunningElapsed startedAt={p.startedAt} />
                ) : p.status === "failed" ? (
                  <span className="text-destructive/90" title={p.error}>
                    {p.error ?? "未知错误"}
                  </span>
                ) : p.elapsedMs !== undefined ? (
                  <span className="tabular-nums">耗时 {formatDuration(p.elapsedMs)}</span>
                ) : (
                  "排队中"
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {p.resultUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreview(p)}
                  className="h-7 px-2 text-xs text-primary-glow"
                >
                  <Maximize2 className="mr-1 h-3 w-3" aria-hidden /> 查看大图
                </Button>
              )}
              {p.status === "failed" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={running}
                  onClick={() => onRetry(p)}
                  aria-label={`重试第 ${i + 1} 页`}
                  className="h-7 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 重试
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
        {/* One role="status" line, not one per page: a screen reader should hear the
            batch's shape when it changes, not 24 separate announcements. */}
        <p className="text-xs text-muted-foreground tabular-nums" role="status">
          {s.done} 完成 · {s.running} 进行中 · {s.failed} 失败 · {s.pending} 等待
        </p>
        {failed.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={running}
            onClick={onRetryFailed}
            className="h-7 text-xs"
          >
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 重试失败项 ({failed.length})
          </Button>
        )}
      </div>
    </section>
  );
}
