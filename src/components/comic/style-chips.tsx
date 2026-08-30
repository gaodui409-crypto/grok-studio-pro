import { Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { COLOR_STYLES } from "@/lib/comic-batch";

export const CUSTOM_STYLE = "自定义";

/**
 * Styles as chips rather than a <Select>.
 *
 * Six options all fit on screen, so a dropdown was hiding five of them behind a
 * click and costing the user a comparison they can now make at a glance.
 */
export function StyleChips({
  value,
  custom,
  onValue,
  onCustom,
  disabled,
}: {
  value: string;
  custom: string;
  onValue: (v: string) => void;
  onCustom: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">上色风格</Label>
      <div className="flex flex-wrap gap-2">
        {COLOR_STYLES.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onValue(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                active
                  ? "border-primary/60 bg-primary/15 text-primary-glow"
                  : "border-border/60 bg-surface/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {active && <Check className="h-3 w-3" aria-hidden />}
              {s}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === CUSTOM_STYLE}
          onClick={() => onValue(CUSTOM_STYLE)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
            value === CUSTOM_STYLE
              ? "border-primary/60 bg-primary/15 text-primary-glow"
              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <Plus className="h-3 w-3" aria-hidden /> 自定义风格
        </button>
      </div>
      {value === CUSTOM_STYLE && (
        <Input
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          disabled={disabled}
          aria-label="自定义上色风格"
          placeholder="例如：低饱和黄昏色调，颗粒质感"
        />
      )}
    </div>
  );
}
