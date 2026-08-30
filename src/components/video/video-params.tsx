import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AspectRatioSelect, ResolutionSelect, VideoModelSelect } from "@/components/param-selects";
import { videoCost } from "@/lib/batch-cost";
import type { ProviderId } from "@/lib/settings";
import type { VideoSubMode } from "@/lib/app-store";

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  onChange,
  note,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </Label>
        <span className="rounded-md border border-border/60 bg-surface/60 px-2 py-0.5 font-mono text-sm tabular-nums text-primary-glow">
          {value} 秒
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      />
      {/* The endpoints, so the range is readable without dragging to find it. */}
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{min} 秒</span>
        <span>{max} 秒</span>
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The parameter rail.
 *
 * Duration is the parameter that decides the bill on this page — 1s and 15s are
 * the same click for a 15× difference — so the estimate sits directly under it
 * rather than in a footnote. Numbers come from batch-cost.ts, which holds the
 * same two published rates already quoted in the model label; a channel with no
 * video endpoint is told so instead of being quoted a price it cannot charge.
 */
export function VideoParams({
  subMode,
  duration,
  extendDuration,
  aspect,
  resolution,
  model,
  provider,
  ready,
  onChange,
}: {
  subMode: VideoSubMode;
  duration: number;
  extendDuration: number;
  aspect: string;
  resolution: "480p" | "720p";
  model: string;
  provider: ProviderId;
  /** False until useSettings has read localStorage. See the estimate below. */
  ready: boolean;
  onChange: (patch: {
    duration?: number;
    extendDuration?: number;
    aspect?: string;
    resolution?: "480p" | "720p";
    model?: string;
  }) => void;
}) {
  const inherits = subMode === "edit";
  const seconds = subMode === "extend" ? extendDuration : duration;
  const cost = videoCost(provider, resolution, seconds);

  return (
    <aside
      aria-label="参数"
      className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card"
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        参数
      </h2>

      {subMode === "extend" ? (
        <SliderRow
          id="video-extend-duration"
          label="延长时长"
          value={extendDuration}
          min={2}
          max={10}
          onChange={(v) => onChange({ extendDuration: v })}
          note={`最终长度 = 原视频长度 + ${extendDuration} 秒。比例和分辨率继承源视频。`}
        />
      ) : inherits ? (
        <p className="rounded-xl border border-border/60 bg-surface/60 p-3 text-xs leading-relaxed text-muted-foreground">
          视频编辑不改变长度、比例和分辨率，全部继承源视频，所以这里没有可调项。
        </p>
      ) : (
        <>
          <SliderRow
            id="video-duration"
            label="时长"
            value={duration}
            min={1}
            max={15}
            onChange={(v) => onChange({ duration: v })}
          />
          <AspectRatioSelect value={aspect} onChange={(v) => onChange({ aspect: v })} />
          <ResolutionSelect
            value={resolution}
            onChange={(v) => onChange({ resolution: v as "480p" | "720p" })}
            options={["480p", "720p"]}
          />
        </>
      )}

      <VideoModelSelect value={model} onChange={(v) => onChange({ model: v })} />

      {/* Quoting a price before the real channel is known would show a dollar
          figure and then correct itself, and a price that moves on its own is a
          price nobody trusts. Same reasoning as the batch page's cost panel. */}
      {!inherits && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] p-3">
          {!ready ? (
            <p className="text-xs text-muted-foreground">读取渠道设置…</p>
          ) : cost.kind === "paid" ? (
            <>
              <p className="text-xs text-muted-foreground">预估费用</p>
              <p className="font-display text-xl font-semibold tabular-nums text-primary-glow">
                ${cost.usd.toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {seconds} 秒 × ${cost.perSecond.toFixed(2)}/秒（{resolution} 官方价）
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              当前渠道没有视频接口，无法预估费用。视频仅 xAI / NewAPI 可用。
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
