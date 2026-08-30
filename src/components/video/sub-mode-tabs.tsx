import { Check } from "lucide-react";
import { VIDEO_SUB_MODES } from "@/lib/video-task";
import type { VideoSubMode } from "@/lib/app-store";

/**
 * The four sub-modes as a segmented control.
 *
 * Not a Radix Tabs: there are no panels to switch — all four modes drive the same
 * form, and which fields appear is decided by `subMode` further down the page. A
 * TabsList with no TabsContent was announcing a tablist whose tabs controlled
 * nothing, so this is a plain radiogroup, which is what the interaction actually is.
 *
 * Each button carries what the mode needs as a second line. Requirements used to
 * surface only as a toast after 执行 had already been pressed.
 */
export function SubModeTabs({
  value,
  onChange,
}: {
  value: VideoSubMode;
  onChange: (next: VideoSubMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="生成模式" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {VIDEO_SUB_MODES.map((mode) => {
        const active = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.id)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              active
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {mode.label}
              {/* The tick is redundant with aria-checked and the fill, so it is
                  hidden from the accessibility tree rather than read out twice. */}
              {active && <Check className="h-3.5 w-3.5 text-primary-glow" aria-hidden />}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{mode.needs}</span>
          </button>
        );
      })}
    </div>
  );
}
