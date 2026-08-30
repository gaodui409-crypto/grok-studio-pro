import { useState } from "react";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

type Item = {
  id: string;
  prompt: string;
  sceneName: string;
};

type Props = {
  items: Item[];
  overrides: Record<string, string>;
  onOverride: (id: string, prompt: string) => void;
  onClearOverride: (id: string) => void;
  onResetAll: () => void;
};

/**
 * Read-through list of the prompts that are about to be sent, each editable in
 * place.
 *
 * Two things were wrong with the earlier version. The per-row buttons were bare
 * icons with no accessible name, so a screen reader read the whole strip as
 * "button button button". And the edit button was a magic wand, which in the rest
 * of this app means "let the model rewrite this" — here it only opens a textarea,
 * so it is a pencil now.
 *
 * Editing keeps a local draft and commits on 保存, so clicking away no longer
 * silently writes a half-typed prompt into the run.
 */
export function PromptPreview({
  items,
  overrides,
  onOverride,
  onClearOverride,
  onResetAll,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setDraft(item.prompt);
  };
  const commit = (id: string) => {
    onOverride(id, draft.trim());
    setEditingId(null);
  };

  const editedCount = Object.keys(overrides).length;

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          提示词预览
        </h3>
        {editedCount > 0 && (
          <Button size="sm" variant="ghost" onClick={onResetAll}>
            <RotateCcw className="mr-1 h-3 w-3" /> 重置 {editedCount} 处编辑
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          勾选服装与动作后，这里会列出每一张图的完整提示词
        </p>
      ) : (
        <ScrollArea className="h-[360px] pr-2">
          <ul className="space-y-2">
            {items.map((p, idx) => {
              const editing = editingId === p.id;
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-border/60 bg-surface/40 p-2.5 text-xs"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-primary-glow">#{idx + 1}</span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="truncate">{p.sceneName}</span>
                      {overrides[p.id] && !editing && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary-glow">
                          已改
                        </span>
                      )}
                      {editing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => commit(p.id)}
                            aria-label={`保存第 ${idx + 1} 条提示词`}
                            className="rounded p-0.5 hover:text-success focus-visible:outline focus-visible:outline-1"
                          >
                            <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label={`取消编辑第 ${idx + 1} 条提示词`}
                            className="rounded p-0.5 hover:text-foreground focus-visible:outline focus-visible:outline-1"
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            aria-label={`编辑第 ${idx + 1} 条提示词`}
                            className="rounded p-0.5 hover:text-foreground focus-visible:outline focus-visible:outline-1"
                          >
                            <Pencil className="h-3 w-3" aria-hidden />
                          </button>
                          {overrides[p.id] && (
                            <button
                              type="button"
                              onClick={() => onClearOverride(p.id)}
                              aria-label={`还原第 ${idx + 1} 条提示词`}
                              className="rounded p-0.5 hover:text-destructive focus-visible:outline focus-visible:outline-1"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {editing ? (
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-h-[80px] resize-none bg-background/60 text-xs"
                      aria-label={`第 ${idx + 1} 条提示词`}
                      autoFocus
                    />
                  ) : (
                    <p className="break-words leading-relaxed text-foreground/85">{p.prompt}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
