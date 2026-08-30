import { Slider } from "@/components/ui/slider";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import type { ResolutionTier, Settings } from "@/lib/settings";

// The concept sketches a 1 / 5 / 10 / 20 / 50 scale. The ceiling stays at 10:
// loadSettings() clamps to that range, and pointing 50 parallel requests at a
// free channel is how you get rate-limited or banned rather than fast.
//
// Only the endpoints are labelled. Intermediate ticks in a flex row sit at even
// spacing, which on a linear 1–10 track would put "5" under the value 5.5 and
// quietly misreport the scale.
const TICKS = [1, 10];

type PanelProps = {
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
};

/**
 * How many requests run at once.
 *
 * Its own card because it governs pacing against the vendor, while the fields in
 * ImageDefaultsPanel describe the picture you want — mixing them meant one card
 * with two unrelated subjects.
 */
export function ConcurrencyPanel({ draft, patch }: PanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Slider
          min={1}
          max={10}
          step={1}
          value={[draft.concurrency]}
          onValueChange={(v) => patch({ concurrency: v[0] })}
          aria-label="并发请求数"
          className="flex-1"
        />
        <span className="w-14 shrink-0 rounded-md border border-border/60 bg-surface py-1 text-center font-mono text-sm text-primary-glow">
          {draft.concurrency}
        </span>
      </div>
      {/* pr-16 keeps the ticks aligned with the track, which stops short of the
          value readout to its right. */}
      <div className="flex justify-between pr-[4.5rem] text-[11px] text-muted-foreground">
        {TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        同人图批量、漫画上色、漫画翻译均使用此并发数。共享免费渠道或同时运行其他会话时建议设为 1。
      </p>
    </div>
  );
}

/** Starting values for new tasks on every channel. */
export function ImageDefaultsPanel({ draft, patch }: PanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AspectRatioSelect
          value={draft.defaultAspectRatio}
          onChange={(defaultAspectRatio) => patch({ defaultAspectRatio })}
        />
        <ResolutionSelect
          value={draft.defaultResolution}
          onChange={(value) => patch({ defaultResolution: value as ResolutionTier })}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        低分辨率档位是为免费渠道准备的：AI Horde 新号 Kudos 为 0 时只能出约 711×711 以下，选 512 或
        768 才不会被拒。各模型还有自己的上限（如 Z-Image-Turbo 1664），超出会自动收敛。
      </p>
    </div>
  );
}
