import { Link } from "@tanstack/react-router";
import { useQuota } from "@/hooks/use-quota";
import { cn } from "@/lib/utils";

/**
 * Remaining-today for the selected channel, in the params rail.
 *
 * Renders nothing when no cap is configured. Most channels here meter something
 * that is not per-day at all (Pollinations' non-refreshing Pollen, AI Horde
 * Kudos) or are pay-as-you-go, so an "unlimited" badge would be claiming a fact
 * the app does not have — and the two channels that *do* document a daily number
 * are the ones a user runs batches against.
 *
 * "剩余 N" rather than "已用 N": the question being asked at this spot on the page
 * is whether the batch about to be submitted will fit.
 */
export function QuotaBadge() {
  const { status, ready } = useQuota();

  if (!ready || !status || status.limit === null) return null;

  const { remaining, limit, used, exhausted, low } = status;

  return (
    <Link
      to="/settings"
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-primary/60",
        exhausted
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : low
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-border/60 bg-surface text-muted-foreground",
      )}
      // The number is an estimate, and the tooltip is where that fits without
      // pushing the badge to two lines.
      title={`本浏览器今日已用 ${used} / ${limit}，为本地估算。点击到设置页调整上限或清零。`}
    >
      <span>今日剩余</span>
      <span className="font-mono tabular-nums">
        {remaining} / {limit}
      </span>
    </Link>
  );
}
