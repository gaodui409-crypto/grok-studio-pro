import { useId, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IMAGE_MODELS, RESOLUTION_TIERS, VIDEO_MODELS } from "@/lib/settings";
import type { ResolutionLimit } from "@/lib/resolution-limits";

/**
 * A labelled parameter select.
 *
 * The four selects below each had a `<Label>` with no `htmlFor` sitting above a
 * `SelectTrigger` with no `id`, so the label was decorative text: every parameter
 * control on the 文生图, 同人图批量 and 视频生成 rails was announced as an unnamed
 * combobox, and clicking the label did nothing. useId rather than a fixed string
 * because these render on several pages and nothing stops two from sharing one.
 */
function ParamSelect({
  label,
  value,
  onChange,
  hint,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Reference detail shown under the control, for facts the trigger has no room for. */
  hint?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "2:1",
  "1:2",
  "auto",
];

export function AspectRatioSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ParamSelect label="画面比例" value={value} onChange={onChange}>
      {ASPECT_RATIOS.map((r) => (
        <SelectItem key={r} value={r}>
          {r}
        </SelectItem>
      ))}
    </ParamSelect>
  );
}

// Defaults to the shared image tier list. The video page passes its own
// options ("480p" / "720p"), which are unrelated to image tiers.
const IMAGE_TIER_OPTIONS = RESOLUTION_TIERS.map((tier) => ({ id: tier.id, label: tier.label }));

/**
 * Resolution tiers, optionally narrowed to what the current channel can deliver.
 *
 * `limit` is what makes the ceiling visible. Without it every tier is offered and
 * the request path silently reduces anything too large (see resolution-limits.ts)
 * — a 2k pick on Z-Image-Turbo came back at 1664 with nothing saying why. Passing
 * a limit greys out the unreachable tiers and states the ceiling underneath.
 *
 * Optional on purpose: the settings page sets a *default* tier for every channel
 * at once, so capping it to whichever channel happens to be selected would block
 * a value that is perfectly valid on the others.
 */
export function ResolutionSelect({
  value,
  onChange,
  options = IMAGE_TIER_OPTIONS,
  limit,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: readonly (string | { id: string; label: string })[];
  limit?: ResolutionLimit;
}) {
  // The limit describes image tiers, so it cannot apply to a caller passing its
  // own option list (the video page's 480p/720p).
  const applied = options === IMAGE_TIER_OPTIONS ? limit : undefined;

  const hint = applied?.maxEdge
    ? applied.source === "model"
      ? `当前模型最高支持 ${applied.maxEdge}px`
      : `当前渠道最高支持 ${applied.maxEdge}px`
    : undefined;

  return (
    <ParamSelect label="分辨率" value={value} onChange={onChange} hint={hint}>
      {options.map((option) => {
        const id = typeof option === "string" ? option : option.id;
        const label = typeof option === "string" ? option : option.label;
        const tier = applied?.tiers.find((candidate) => candidate.id === id);
        return (
          <SelectItem
            key={id}
            value={id}
            disabled={tier ? !tier.enabled : undefined}
            hint={tier?.note}
          >
            {label}
          </SelectItem>
        );
      })}
    </ParamSelect>
  );
}

export function ImageModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ParamSelect label="图片模型" value={value} onChange={onChange}>
      {IMAGE_MODELS.map((m) => (
        <SelectItem key={m.id} value={m.id} hint={m.rates}>
          {m.label}
        </SelectItem>
      ))}
    </ParamSelect>
  );
}

export function VideoModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Shown under the select, not in it. Both rates side by side is what makes the
  // 分辨率 choice above answerable — the cost box only ever prices the tier already
  // picked, and in 视频编辑 mode there is no cost box at all (final length comes from
  // the source video, so nothing can be multiplied out until it is uploaded).
  const rates = VIDEO_MODELS.find((m) => m.id === value)?.rates;
  return (
    <ParamSelect label="视频模型" value={value} onChange={onChange} hint={rates}>
      {VIDEO_MODELS.map((m) => (
        <SelectItem key={m.id} value={m.id} hint={m.rates}>
          {m.label}
        </SelectItem>
      ))}
    </ParamSelect>
  );
}
