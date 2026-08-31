import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useQuota } from "@/hooks/use-quota";
import { resetUsage } from "@/lib/quota";
import type { ProviderId, Settings } from "@/lib/settings";

/**
 * Today's usage for one channel, plus the cap it is measured against.
 *
 * The number is a LOCAL tally of what this browser sent (see lib/quota.ts) — no
 * channel here publishes a "remaining today" endpoint. That is stated in the hint
 * rather than dressed up, because a figure the user trusts as the vendor's own
 * would be believed right up to the point a batch dies half-finished.
 *
 * The cap lives in settings (so it goes through 保存 like every other field) while
 * the tally lives in its own localStorage ledger and 清零 takes effect at once.
 * The two behaving differently in the same card is worth one line of explanation,
 * which is cheaper than making the reset wait for a save it has nothing to do with.
 */
export function QuotaPanel({
  provider,
  draft,
  patch,
}: {
  provider: ProviderId;
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
}) {
  const { status, ready } = useQuota(provider);
  const limit = draft.dailyLimits?.[provider];
  const used = status?.used ?? 0;

  // Percentage against the *draft* cap, so dragging the number re-draws the bar
  // before saving. Only drawn when there is a cap: a bar with no ceiling would
  // have to invent one.
  const percent =
    typeof limit === "number" && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;

  const remaining = typeof limit === "number" && limit > 0 ? Math.max(0, limit - used) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">今日已用</p>
          <p className="mt-0.5 font-mono text-2xl text-primary-glow tabular-nums">
            {/* Dash rather than 0 until the ledger has actually been read: "0 已用"
                on a channel you have spent is a wrong number, not a neutral one. */}
            {ready ? used : "—"}
            {typeof limit === "number" && limit > 0 && (
              <span className="ml-1 font-sans text-sm text-muted-foreground">/ {limit}</span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!ready || used === 0}
          onClick={() => resetUsage(provider)}
          className="h-7 text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 清零
        </Button>
      </div>

      {percent !== null && (
        <Progress
          value={percent}
          aria-label={`今日额度已用 ${percent}%`}
          className={
            status?.exhausted
              ? "[&>div]:bg-destructive"
              : status?.low
                ? "[&>div]:bg-warning"
                : undefined
          }
        />
      )}

      {ready && status?.exhausted && (
        <p className="text-xs text-destructive">
          本地计数已达上限。仍可继续提交——这个数字是本浏览器的估算，渠道那边可能还有余量。
        </p>
      )}
      {ready && status?.low && (
        <p className="text-xs text-warning">剩余约 {remaining} 张，接近本地上限。</p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`daily-limit-${provider}`}>每日上限</Label>
        <Input
          id={`daily-limit-${provider}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={limit ?? ""}
          placeholder="留空 = 不限"
          onChange={(e) => {
            const raw = e.target.value.trim();
            const next = { ...(draft.dailyLimits ?? {}) };
            const parsed = Number(raw);
            // Empty or non-positive clears the cap rather than storing 0: quota.ts
            // treats 0 as "no cap configured", and a stored 0 would read in the UI
            // as a real ceiling of zero.
            if (!raw || !Number.isFinite(parsed) || parsed <= 0) delete next[provider];
            else next[provider] = Math.floor(parsed);
            patch({ dailyLimits: next });
          }}
          className="max-w-[12rem] font-mono"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          这个数字由本浏览器自己累计，不是渠道返回的余量：换设备、换浏览器，或请求已经到达渠道但响应丢了，都会和真实用量对不上。
          上限改动要按右上角保存；「清零」立即生效。
        </p>
      </div>
    </div>
  );
}
