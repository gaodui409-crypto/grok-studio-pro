import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  PauseCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatElapsed, phaseLabel, progressPercent, shortRequestId } from "@/lib/video-task";
import type { TaskPhase } from "@/lib/video-task";
import type { VideoStatus } from "@/lib/xai";

/**
 * The elapsed clock, isolated so its 100ms tick re-renders one <span> instead of
 * the whole card.
 */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <span className="font-mono tabular-nums">{formatElapsed(now - startedAt)}</span>;
}

/**
 * The submitted-task card: what it is, how long it has been going, and the two
 * things you can do about it.
 *
 * Replaces a single line reading `状态：pending 5%`. Three things were missing and
 * all three cost money:
 *
 * - The request_id, which only ever appeared in a toast. It is the only handle to
 *   a job that is already billing, so it is now a chip with a copy button.
 * - Cancel. pollVideo has always returned a `stop` handle and the page dropped it
 *   on the floor, so a submitted task could only be waited out.
 * - A way back. If polling stopped without a verdict the render is still running
 *   server-side, so 继续查询 re-attaches instead of making the user re-submit and
 *   pay twice.
 */
export function TaskProgress({
  phase,
  status,
  requestId,
  startedAt,
  pollError,
  onCancel,
  onResume,
}: {
  phase: TaskPhase;
  status: VideoStatus | null;
  requestId: string | null;
  startedAt: number | null;
  pollError: string | null;
  onCancel: () => void;
  onResume: () => void;
}) {
  if (phase === "idle") return null;

  const percent = progressPercent(status);
  const active = phase === "submitting" || phase === "polling";
  // A dropped poll is 停止, not 失败: pollError means the connection to the task
  // died, while the task itself is still rendering and still billing. Only a
  // verdict from the server — failed or expired — earns the warning triangle.
  const stopped = phase === "stopped" || Boolean(pollError);
  const failed = phase === "failed" && !pollError;

  const copyId = async () => {
    if (!requestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
      toast.success("已复制 request_id");
    } catch {
      // Clipboard needs a permission that a headless or locked-down browser may
      // refuse. Failing silently would look like the button does nothing.
      toast.error("复制失败，请手动选中下方 id");
    }
  };

  return (
    <section
      aria-label="任务状态"
      className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {failed ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        ) : stopped ? (
          <PauseCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : phase === "done" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-glow" aria-hidden />
        )}

        {/* One live region for the whole card. Announcing the percentage and the
            stage separately made a screen reader interrupt itself every 5s. */}
        <p role="status" className="text-sm font-medium">
          {phaseLabel(phase, status)}
          {active && startedAt !== null && (
            <span className="ml-2 font-normal text-muted-foreground">
              已用 <Elapsed startedAt={startedAt} />
            </span>
          )}
          {phase === "done" && startedAt !== null && (
            <span className="ml-2 font-normal text-muted-foreground">
              用时 {formatElapsed(Date.now() - startedAt)}
            </span>
          )}
        </p>

        {requestId && (
          <span className="ml-auto flex items-center gap-1.5">
            <code
              title={requestId}
              className="rounded-md border border-border/60 bg-surface/60 px-2 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {shortRequestId(requestId)}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={copyId}
              aria-label="复制 request_id"
              className="h-7 w-7"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        )}

        {percent !== null && (
          <span className="font-display text-2xl font-semibold tabular-nums text-primary-glow">
            {percent}%
          </span>
        )}
      </div>

      {/* Indeterminate when the API sends no progress field, which is the usual
          case. The old code filled in 5% instead, so a three-minute render sat at
          a number that never moved and read as stuck. */}
      {percent !== null ? (
        <Progress value={percent} />
      ) : (
        active && (
          <div
            className="h-2 overflow-hidden rounded-full bg-surface"
            role="presentation"
            aria-hidden
          >
            <div className="h-full w-1/3 animate-indeterminate rounded-full bg-gradient-primary" />
          </div>
        )
      )}

      {active && !percent && (
        <p className="text-xs text-muted-foreground">
          该接口只在完成时返回结果，中途没有进度百分比，因此这里显示实时用时。
        </p>
      )}

      {/* Warning-coloured because the connection genuinely broke, even though the
          task did not: colour tracks "something unexpected happened", while the
          label and icon above track "is this task dead". A deliberate cancel gets
          neither — nothing went wrong there — but still needs to say that the
          render continues, or 已停止查询 reads as 已停止生成. */}
      {pollError ? (
        <p className="text-xs leading-relaxed text-warning">
          轮询中断：{pollError}。任务可能仍在服务端生成中，可以用上面的 request_id 继续查询，
          不必重新提交（重新提交会再计费一次）。
        </p>
      ) : (
        phase === "stopped" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            已停止本页查询。服务端可能仍在生成并计费，可以用上面的 request_id 继续查询，
            不必重新提交（重新提交会再计费一次）。
          </p>
        )
      )}

      {status?.error && <p className="text-xs leading-relaxed text-warning">{status.error}</p>}

      <div className="flex flex-wrap gap-2">
        {active && (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            <X className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 取消任务
          </Button>
        )}
        {/* Offered for 失败 as well as 停止: a submit that failed before returning an
            id has nothing to resume, but once an id exists the render may well have
            started, and re-submitting to find out bills a second time. */}
        {!active && requestId && phase !== "done" && (
          <Button type="button" variant="secondary" size="sm" onClick={onResume}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 继续查询
          </Button>
        )}
      </div>

      {active && (
        <p className="text-[11px] text-muted-foreground">
          取消只是停止本页查询，服务端可能已经开始计费。
        </p>
      )}
    </section>
  );
}
