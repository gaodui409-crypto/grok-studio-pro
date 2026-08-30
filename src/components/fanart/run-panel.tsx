import { Sparkles, Loader2, Ban, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { FanartRunItem } from "@/lib/app-store";
import { cn } from "@/lib/utils";

/**
 * One square per image in the batch, coloured by outcome.
 *
 * The page used to show `done/total` and a bar. That says how far along a run is
 * but nothing about what happened: a run ending 20/24 left no trace of which four
 * failed — the errors had gone past as toasts, and four missing images look
 * exactly like four that were never requested. Each square keeps its own state
 * and names it in the title, so a failure is still there to read afterwards.
 */
function StatusStrip({ items }: { items: FanartRunItem[] }) {
  const cls = (status: FanartRunItem["status"]) =>
    status === "done"
      ? "border-success/60 bg-success/20 text-success"
      : status === "failed"
        ? "border-destructive/60 bg-destructive/20 text-destructive"
        : status === "running"
          ? "border-primary/60 bg-primary/20 text-primary-glow animate-pulse"
          : "border-border/60 bg-surface text-muted-foreground";

  const word = { pending: "等待中", running: "生成中", done: "已完成", failed: "失败" } as const;

  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <li
          key={item.id}
          title={`${i + 1}. ${item.label} — ${word[item.status]}${item.error ? `：${item.error}` : ""}`}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded border font-mono text-[10px] transition",
            cls(item.status),
          )}
        >
          {i + 1}
        </li>
      ))}
    </ul>
  );
}

export function RunPanel({
  count,
  running,
  items,
  onRun,
  onCancel,
}: {
  count: number;
  running: boolean;
  items: FanartRunItem[];
  onRun: () => void;
  onCancel: () => void;
}) {
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const settled = done + failed;
  const current = items.find((i) => i.status === "running");
  const pct = items.length ? (settled / items.length) * 100 : 0;

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      {/* Unnumbered for the same reason as CostPanel. */}
      <h2 className="font-display text-sm font-semibold tracking-tight">执行</h2>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onRun}
          disabled={running || count === 0}
          className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          )}
          {running ? "批量生成中…" : count === 0 ? "先勾选服装或动作" : `开始生成 · ${count} 张`}
        </Button>
        {running && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            <Ban className="mr-2 h-4 w-4" aria-hidden /> 取消全部
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">进度</span>
            <span className="flex items-center gap-2.5 font-mono">
              <span className="flex items-center gap-1 text-success">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                {done}
              </span>
              {failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <CircleX className="h-3.5 w-3.5" aria-hidden />
                  {failed}
                </span>
              )}
              <span className="text-muted-foreground">/ {items.length}</span>
            </span>
          </div>
          <Progress value={pct} aria-label="批量生成进度" />
          <StatusStrip items={items} />
          {/* One live region for the whole run. Announcing every square would
              flood a screen reader with 24 updates; this reports the item being
              worked on and, at the end, the outcome. */}
          <p role="status" className="line-clamp-2 min-h-[1rem] text-xs text-muted-foreground">
            {running
              ? current
                ? `正在生成第 ${items.indexOf(current) + 1} 张 · ${current.label}`
                : "正在排队…"
              : failed > 0
                ? `已结束：成功 ${done} 张，失败 ${failed} 张（把鼠标移到方块上看原因）`
                : `已完成 ${done} 张`}
          </p>
        </div>
      )}
    </section>
  );
}
