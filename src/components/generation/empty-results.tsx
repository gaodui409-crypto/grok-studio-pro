import { ImageIcon, Sparkles } from "lucide-react";

/**
 * What fills the results area before anything has been generated.
 *
 * The page used to render nothing here, so a first-time visitor got a prompt box,
 * a params panel, and a large empty space that gave no hint about what to do or
 * why nothing happened.
 *
 * Deliberately says nothing about channel setup. An earlier version put a "go
 * configure a channel" button here, gated on `enabledProviders(settings).length
 * === 0` — a condition that is never true, because AI Horde needs no credentials
 * and so counts as ready for everyone. Even with a working condition it would
 * duplicate ApiKeyBanner at the top of the page, which is the better of the two:
 * it tests the channel actually selected and names the exact credential missing,
 * where this could only have said "some channel somewhere".
 */
export function EmptyResults({
  examples,
  onPick,
}: {
  examples: readonly string[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-surface/60">
          <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tight">还没有生成过任何图片</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          写下提示词，或者从下面挑一个开始。
        </p>
      </div>

      <div className="mt-8">
        {/* A caption, not a heading: it labels four buttons, and as an h3 it would
            compete with this panel's own h2 for no benefit. */}
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-border/60" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            示例提示词
          </span>
          <span className="h-px flex-1 bg-border/60" />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onPick(example)}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 text-sm text-foreground/90 transition hover:border-primary/40 hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-glow" aria-hidden />
              {example}
            </button>
          ))}
        </div>
        {/* Picking an example fills the box instead of generating immediately:
            these are starting points meant to be edited, and firing a request on
            a single click would spend a free channel's daily quota by accident. */}
        <p className="mt-3 text-center text-xs text-muted-foreground">点击填入提示词，可再修改</p>
      </div>
    </div>
  );
}
