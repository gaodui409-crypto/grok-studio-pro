import { AlertTriangle, Info } from "lucide-react";
import { batchCost, quotaNote } from "@/lib/batch-cost";
import type { ProviderId } from "@/lib/settings";

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-display text-2xl font-semibold tracking-tight text-primary-glow">
        {value}
      </p>
      {note && <p className="truncate text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The confirm-before-you-spend panel.
 *
 * Previously three small rows in a dashed box, easy to scroll past — which is the
 * wrong weight for the one number that tells you a click is about to make dozens
 * of billed requests. The count is the largest thing on the page after the
 * heading.
 *
 * The cost figure is per-channel via batchCost(). It used to be
 * `count * 0.07` unconditionally, xAI's Image Pro price, so a 24-image run on
 * Gitee's free daily 100 was labelled "$1.68" — a charge that channel is
 * incapable of making, presented with enough authority to talk someone out of a
 * batch they were entitled to run.
 */
export function CostPanel({
  count,
  provider,
  model,
  concurrency,
  ready,
}: {
  count: number;
  provider: ProviderId;
  model: string;
  concurrency: number;
  /** False until the real channel is known. See the money figure below. */
  ready: boolean;
}) {
  const cost = batchCost(provider, model, count);
  const big = count >= 24;

  // Until the settings hook has read localStorage, `provider` is the default
  // channel rather than the chosen one, and pricing the batch against the wrong
  // channel is worse than briefly saying nothing: the first paint would quote a
  // dollar figure for a free channel and then correct itself, and a price that
  // moves on its own is a price nobody trusts.
  const money = !ready
    ? { value: "…", note: "读取渠道设置" }
    : cost.kind === "paid"
      ? { value: `$${cost.usd.toFixed(2)}`, note: `$${cost.perImage.toFixed(2)}/张` }
      : cost.kind === "free"
        ? { value: "免费", note: "用免费额度" }
        : { value: "未知", note: "该渠道额度未公开" };

  return (
    <section
      aria-label="预估消耗"
      className="rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] p-5"
    >
      {/* Unnumbered, unlike the form cards on the left. This panel sits at the top
          of a sticky column beside step 1, so calling it step 6 made the numbering
          jump 1 → 6 across the page at the same height. It is not a step you work
          through; it is the summary of the five that are. */}
      <h2 className="mb-4 flex items-baseline gap-2 font-display text-sm font-semibold tracking-tight">
        预估消耗
        <span className="font-sans text-xs font-normal text-muted-foreground">
          确认后再开始，避免浪费额度
        </span>
      </h2>

      <div className="grid grid-cols-3 gap-3">
        <Figure label="将生成" value={`${count} 张`} />
        <Figure label="预估费用" value={money.value} note={money.note} />
        <Figure label="并发数" value={String(concurrency)} note="在设置中调整" />
      </div>

      {ready && cost.kind !== "paid" && (
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{quotaNote(provider)}</span>
        </p>
      )}

      {/* A daily-limited channel is the case where an accidental large batch
          actually costs something you cannot get back until tomorrow. */}
      {big && (
        <p className="mt-3 flex gap-2 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            这一批有 {count} 张。免费渠道多为每日限额，跑完就得等次日刷新，建议先少量试一次提示词。
          </span>
        </p>
      )}
    </section>
  );
}
