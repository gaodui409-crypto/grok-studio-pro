import { useState } from "react";
import { Check, X, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EditableItem = { value: string; checked: boolean };

export function EditableChipList({
  items,
  onChange,
  placeholder = "添加自定义…",
  multi = true,
}: {
  items: EditableItem[];
  onChange: (next: EditableItem[]) => void;
  placeholder?: string;
  multi?: boolean;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState("");

  const toggle = (i: number) => {
    if (multi) {
      onChange(items.map((it, idx) => (idx === i ? { ...it, checked: !it.checked } : it)));
    } else {
      onChange(items.map((it, idx) => ({ ...it, checked: idx === i ? !it.checked : false })));
    }
  };

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditVal(items[i].value);
  };
  const commitEdit = () => {
    if (editingIdx == null) return;
    const v = editVal.trim();
    if (v) {
      onChange(items.map((it, idx) => (idx === editingIdx ? { ...it, value: v } : it)));
    }
    setEditingIdx(null);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    const v = adding.trim();
    if (!v) return;
    onChange([...items, { value: v, checked: true }]);
    setAdding("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => {
          const editing = editingIdx === i;
          return (
            <div
              key={i}
              className={cn(
                "group flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                it.checked
                  ? "border-primary/60 bg-primary/15 text-foreground shadow-[0_0_10px_oklch(0.65_0.21_285/0.25)]"
                  : "border-border/60 bg-surface text-muted-foreground hover:border-primary/30",
              )}
            >
              {editing ? (
                <>
                  <Input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") setEditingIdx(null);
                    }}
                    className="h-6 w-32 px-1.5 text-xs"
                  />
                  <button onClick={commitEdit} className="text-success">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setEditingIdx(null)} className="text-muted-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  {/* One button, not a Checkbox plus a label button.
                      The pair was two tab stops for one action, the checkbox had
                      no accessible name, and the label carried no state at all.
                      It also caused a hydration error on every visit to this page:
                      Radix's hidden form input spreads a useSize() ResizeObserver
                      result into its inline style, which is undefined on the server
                      and {width,height} once the observer fires — so whether the
                      markup matched depended on machine load. Nothing here is
                      submitted, so the form input had no purpose to begin with. */}
                  <button
                    type="button"
                    aria-pressed={it.checked}
                    onClick={() => toggle(i)}
                    className="flex select-none items-center gap-1"
                  >
                    <Check
                      className={cn(
                        "h-3 w-3 shrink-0 transition",
                        it.checked ? "text-primary-glow" : "opacity-25",
                      )}
                      aria-hidden
                    />
                    {it.value}
                  </button>
                  {/* Hidden until hover for mouse users, but focus-visible brings
                      them back: opacity-0 alone left keyboard users tabbing onto
                      controls they could not see. */}
                  <button
                    type="button"
                    aria-label={`重命名「${it.value}」`}
                    onClick={() => startEdit(i)}
                    className="opacity-0 transition focus-visible:opacity-100 group-hover:opacity-70 hover:!opacity-100"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除「${it.value}」`}
                    onClick={() => remove(i)}
                    className="opacity-0 transition focus-visible:opacity-100 group-hover:opacity-70 hover:!opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-8 bg-background/60 text-xs"
        />
        <Button size="sm" variant="secondary" className="h-8 px-2" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
