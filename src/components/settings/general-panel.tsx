import { Label } from "@/components/ui/label";
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

export function GeneralPanel({
  draft,
  patch,
}: {
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-2 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6">
        <div className="space-y-1">
          <Label>并发请求数</Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            同人图批量、漫画上色、漫画翻译均使用此并发数。共享免费渠道或同时运行其他会话时建议设为
            1。
          </p>
        </div>
        <div className="space-y-2">
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
            <span className="w-12 shrink-0 rounded-md border border-border/60 bg-surface py-1 text-center font-mono text-sm text-primary-glow">
              {draft.concurrency}
            </span>
          </div>
          <div className="flex justify-between pr-16 text-[11px] text-muted-foreground">
            {TICKS.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
