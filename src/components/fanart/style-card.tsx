import { Label } from "@/components/ui/label";
import { EditableChipList, type EditableItem } from "@/components/editable-chip-list";
import { SectionCard } from "./section-card";
import { cn } from "@/lib/utils";

/**
 * One single-select chip row with an explicit "none" option.
 *
 * The "none" button is not decoration: with a multi-select chip list, unchecking
 * the last chip is the only way to express "let the model decide", and that is
 * indistinguishable from having forgotten to pick one. A button that is *itself*
 * selected when nothing else is makes the empty state a deliberate choice.
 */
function ChipRow({
  label,
  items,
  selected,
  onClear,
  onChange,
  placeholder,
}: {
  label: string;
  items: EditableItem[];
  selected: string;
  onClear: () => void;
  onChange: (items: EditableItem[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        <button
          type="button"
          aria-pressed={selected === ""}
          onClick={onClear}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs transition",
            selected === ""
              ? "border-primary/60 bg-primary/20 text-primary-glow"
              : "border-border/60 text-muted-foreground hover:border-primary/40",
          )}
        >
          不指定
        </button>
      </div>
      <EditableChipList multi={false} items={items} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export function StyleCard({
  step,
  styles,
  lighting,
  styleSel,
  lightSel,
  onStyles,
  onLighting,
  onStyleSel,
  onLightSel,
}: {
  step: number;
  styles: string[];
  lighting: string[];
  styleSel: string;
  lightSel: string;
  onStyles: (next: string[]) => void;
  onLighting: (next: string[]) => void;
  onStyleSel: (next: string) => void;
  onLightSel: (next: string) => void;
}) {
  const pick = (items: EditableItem[]) => items.find((i) => i.checked)?.value ?? "";

  return (
    <SectionCard step={step} title="画风与光影" hint="各选一项，或都不指定">
      <div className="space-y-5">
        <ChipRow
          label="画风"
          items={styles.map((v) => ({ value: v, checked: v === styleSel }))}
          selected={styleSel}
          onClear={() => onStyleSel("")}
          onChange={(items) => {
            onStyles(items.map((i) => i.value));
            onStyleSel(pick(items));
          }}
          placeholder="添加画风…"
        />
        <ChipRow
          label="光影氛围"
          items={lighting.map((v) => ({ value: v, checked: v === lightSel }))}
          selected={lightSel}
          onClear={() => onLightSel("")}
          onChange={(items) => {
            onLighting(items.map((i) => i.value));
            onLightSel(pick(items));
          }}
          placeholder="添加光影…"
        />
      </div>
    </SectionCard>
  );
}
