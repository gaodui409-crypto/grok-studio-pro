import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILTIN_PRESETS,
  loadCustomPresets,
  saveCustomPresets,
  newCustomPreset,
  type CharacterPreset,
} from "@/lib/character-presets";

function PresetEditor({
  draft,
  setDraft,
  onCancel,
  onCommit,
  updateScene,
}: {
  draft: CharacterPreset;
  setDraft: (p: CharacterPreset) => void;
  onCancel: () => void;
  onCommit: () => void;
  updateScene: (idx: number, patch: Partial<CharacterPreset["scenes"][number]>) => void;
}) {
  const addScene = () =>
    setDraft({
      ...draft,
      scenes: [...draft.scenes, { sceneName: "新场景", outfits: [], actions: [] }],
    });
  const removeScene = (i: number) =>
    setDraft({ ...draft, scenes: draft.scenes.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-surface/60 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">名称</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">默认画风</Label>
          <Input
            value={draft.defaultStyle ?? ""}
            onChange={(e) => setDraft({ ...draft, defaultStyle: e.target.value })}
            className="h-8 text-sm"
            placeholder="动漫赛璐璐"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">角色描述（提示词主体）</Label>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="min-h-[80px] resize-none text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">默认光影</Label>
        <Input
          value={draft.defaultLighting ?? ""}
          onChange={(e) => setDraft({ ...draft, defaultLighting: e.target.value })}
          className="h-8 text-sm"
          placeholder="柔和晨光"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">场景配置（场景名匹配场景树中的场景）</Label>
          <Button size="sm" variant="ghost" onClick={addScene}>
            <Plus className="h-3.5 w-3.5" /> 添加
          </Button>
        </div>
        {draft.scenes.map((s, i) => (
          <div
            key={i}
            className="space-y-1.5 rounded border border-border/60 bg-background/60 p-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <Input
                value={s.sceneName}
                onChange={(e) => updateScene(i, { sceneName: e.target.value })}
                className="h-7 w-32 text-xs"
                placeholder="场景名"
              />
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6 text-destructive"
                onClick={() => removeScene(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={s.outfits.join("\n")}
              onChange={(e) =>
                updateScene(i, {
                  outfits: e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[60px] resize-none text-xs"
              placeholder="服装（每行一个）"
            />
            <Textarea
              value={s.actions.join("\n")}
              onChange={(e) =>
                updateScene(i, {
                  actions: e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[60px] resize-none text-xs"
              placeholder="动作（每行一个）"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" /> 取消
        </Button>
        <Button size="sm" onClick={onCommit}>
          <Check className="mr-1 h-3.5 w-3.5" /> 保存
        </Button>
      </div>
    </div>
  );
}
/**
 * Custom character presets.
 *
 * These persist on their own — saveCustomPresets() runs when you commit an
 * editor, independent of the page's 保存 button and its settings draft. They
 * live in a different localStorage key with a different shape, and an unsaved
 * preset editor left open should not block saving an API key.
 */
export function PresetManager() {
  const [list, setList] = useState<CharacterPreset[]>(loadCustomPresets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CharacterPreset | null>(null);

  const persist = (next: CharacterPreset[]) => {
    setList(next);
    saveCustomPresets(next);
  };

  const startNew = () => {
    const p = newCustomPreset();
    setDraft(p);
    setEditingId(p.id);
  };

  const startEdit = (p: CharacterPreset) => {
    setDraft({
      ...p,
      scenes: p.scenes.map((s) => ({ ...s, outfits: [...s.outfits], actions: [...s.actions] })),
    });
    setEditingId(p.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const commitEdit = () => {
    if (!draft) return;
    const exists = list.some((p) => p.id === draft.id);
    persist(exists ? list.map((p) => (p.id === draft.id ? draft : p)) : [...list, draft]);
    cancelEdit();
    toast.success("预设已保存");
  };

  const remove = (id: string) => {
    if (!confirm("删除此自定义预设？")) return;
    persist(list.filter((p) => p.id !== id));
  };

  const updateScene = (idx: number, patch: Partial<CharacterPreset["scenes"][number]>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      scenes: draft.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">内置预设（只读）</p>
        <Button size="sm" variant="secondary" onClick={startNew} disabled={!!editingId}>
          <Plus className="mr-1 h-4 w-4" /> 新建预设
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BUILTIN_PRESETS.map((p) => (
          <span
            key={p.id}
            className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs"
          >
            ★ {p.name}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          自定义预设 ({list.length})
        </p>
        {list.length === 0 && !editingId && (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            暂无自定义预设。点击「新建预设」添加你自己的角色。
          </p>
        )}
        <div className="space-y-2">
          {list.map((p) =>
            editingId === p.id && draft ? (
              <PresetEditor
                key={p.id}
                draft={draft}
                setDraft={setDraft}
                onCancel={cancelEdit}
                onCommit={commitEdit}
                updateScene={updateScene}
              />
            ) : (
              <div
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.scenes.length} 个场景配置
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => startEdit(p)}
                    aria-label={`编辑预设 ${p.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remove(p.id)}
                    aria-label={`删除预设 ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ),
          )}
          {editingId && draft && !list.some((p) => p.id === draft.id) && (
            <PresetEditor
              draft={draft}
              setDraft={setDraft}
              onCancel={cancelEdit}
              onCommit={commitEdit}
              updateScene={updateScene}
            />
          )}
        </div>
      </div>
    </div>
  );
}
