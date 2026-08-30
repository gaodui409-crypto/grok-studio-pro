import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RunSummaryData = {
  /** How many images came back. */
  count: number;
  /** How many were asked for. Differs from `count` when a channel returns short. */
  requested: number;
  seconds: number;
  provider: string;
};

/**
 * One line describing the run that produced the images below it.
 *
 * Both counts are shown rather than just the total, because a channel returning 2
 * of 4 is the single most confusing thing that can happen here: without the
 * requested number the result looks complete and the user reads it as "I asked for
 * 2". When they differ the line says so explicitly instead of leaving it to be
 * inferred from the grid.
 */
export function RunSummary({
  data,
  onRegenerate,
  disabled,
}: {
  data: RunSummaryData;
  onRegenerate: () => void;
  disabled?: boolean;
}) {
  const short = data.count < data.requested;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {short ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
        )}
        <span className="truncate">
          {short ? (
            <>
              渠道只返回 {data.count} / {data.requested} 张
            </>
          ) : (
            <>已生成 {data.count} 张</>
          )}
          {" · 用时 "}
          {data.seconds.toFixed(1)} 秒 · 渠道：{data.provider}
        </span>
      </p>
      <Button size="sm" variant="secondary" onClick={onRegenerate} disabled={disabled}>
        <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
        重新生成
      </Button>
    </div>
  );
}
