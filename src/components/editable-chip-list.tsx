import { useState } from "react";
import { Check, X, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
                      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                      if (e.key === "Escape") setEditingIdx(null);
                    }}
                    className="h-6 w-32 px-1.5 text-xs"
                  />
                  <button onClick={commitEdit} className="text-success"><Check className="h-3 w-3" /></button>
                  <button onClick={() => setEditingIdx(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                </>
              ) : (
                <>
                  <Checkbox
                    checked={it.checked}
                    onCheckedChange={() => toggle(i)}
                    className="h-3.5 w-3.5"
                  />
                  <button onClick={() => toggle(i)} className="select-none">{it.value}</button>
                  <button
                    onClick={() => startEdit(i)}
                    className="opacity-0 transition group-hover:opacity-70 hover:!opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="opacity-0 transition group-hover:opacity-70 hover:!opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
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
