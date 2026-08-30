import { useState } from "react";
import { Plus, Trash2, Pencil, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EditableChipList, type EditableItem } from "@/components/editable-chip-list";
import { SectionCard } from "./section-card";
import type { Scene } from "@/lib/scene-tree";
import type { SceneSel } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export function SceneTreeCard({
  step,
  scenes,
  mode,
  activeSceneId,
  getSel,
  onPickActive,
  onRenameScene,
  onRemoveScene,
  onAddScene,
  onSetItems,
  onReset,
}: {
  step: number;
  scenes: Scene[];
  mode: "single" | "multi";
  activeSceneId: string;
  getSel: (sceneId: string) => SceneSel;
  onPickActive: (sceneId: string) => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onRemoveScene: (sceneId: string) => void;
  onAddScene: (name: string) => void;
  onSetItems: (scene: Scene, kind: "outfits" | "actions", items: EditableItem[]) => void;
  onReset: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newScene, setNewScene] = useState("");

  const sceneItems = (scene: Scene, kind: "outfits" | "actions"): EditableItem[] => {
    const checks = getSel(scene.id)[kind];
    return scene[kind].map((v) => ({ value: v, checked: !!checks[v] }));
  };

  const submitNew = () => {
    onAddScene(newScene.trim() || "新场景");
    setNewScene("");
  };

  return (
    <SectionCard
      step={step}
      title="场景树"
      hint={mode === "single" ? "勾选服装与动作，生成全组合" : "勾选过的场景会依次生成"}
      action={
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 重置
        </Button>
      }
    >
      <Accordion type="multiple" className="space-y-2">
        {scenes.map((scene) => {
          const sel = getSel(scene.id);
          const checkedCount =
            Object.values(sel.outfits).filter(Boolean).length +
            Object.values(sel.actions).filter(Boolean).length;
          const isActive = mode === "single" && activeSceneId === scene.id;
          const editing = editingId === scene.id;

          const commit = () => {
            onRenameScene(scene.id, editingName.trim() || scene.name);
            setEditingId(null);
          };

          return (
            <AccordionItem
              key={scene.id}
              value={scene.id}
              className={cn(
                "overflow-hidden rounded-xl border border-border/60 bg-surface/40 px-3 transition",
                isActive && "border-primary/60 shadow-[0_0_14px_oklch(0.65_0.21_285/0.2)]",
              )}
            >
              {/* Row actions are SIBLINGS of the trigger, not children of it.
                  AccordionTrigger renders a <button>, so nesting these buttons
                  (and the rename <input>) inside it was invalid HTML: React threw
                  a hydration error on every visit, and keyboard users could never
                  reach the inner controls. */}
              <div className="flex items-center gap-2 pr-1">
                {editing ? (
                  <div className="flex flex-1 items-center gap-1 py-3">
                    <Input
                      autoFocus
                      aria-label={`场景新名称（原名 ${scene.name}）`}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commit();
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 w-44 text-sm"
                    />
                    <button type="button" aria-label="确认重命名" onClick={commit}>
                      <Check className="h-4 w-4 text-success" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <AccordionTrigger className="min-w-0 flex-1 py-3 hover:no-underline">
                    <span className="truncate text-base font-semibold">{scene.name}</span>
                  </AccordionTrigger>
                )}
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {checkedCount > 0 && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary-glow">
                      已选 {checkedCount}
                    </span>
                  )}
                  {mode === "single" && (
                    <button
                      type="button"
                      // aria-pressed rather than relying on the label change
                      // alone: the button is the radio-like selector for which
                      // scene runs, and its state has to be readable, not inferred
                      // from the colour.
                      aria-pressed={isActive}
                      onClick={() => onPickActive(scene.id)}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-2 py-0.5 transition",
                        isActive
                          ? "border-primary/60 bg-primary/20 text-primary-glow"
                          : "border-border/60 hover:border-primary/40",
                      )}
                    >
                      {isActive ? "当前生成" : "选为生成场景"}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`重命名场景 ${scene.name}`}
                    onClick={() => {
                      setEditingId(scene.id);
                      setEditingName(scene.name);
                    }}
                    className="opacity-60 transition focus-visible:opacity-100 hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除场景 ${scene.name}`}
                    onClick={() => onRemoveScene(scene.id)}
                    className="opacity-60 transition focus-visible:opacity-100 hover:text-destructive hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <AccordionContent className="space-y-4 pb-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    服装
                  </Label>
                  <EditableChipList
                    items={sceneItems(scene, "outfits")}
                    onChange={(items) => onSetItems(scene, "outfits", items)}
                    placeholder="添加服装…"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    动作
                  </Label>
                  <EditableChipList
                    items={sceneItems(scene, "actions")}
                    onChange={(items) => onSetItems(scene, "actions", items)}
                    placeholder="添加动作…"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="flex gap-2 pt-3">
        <Input
          aria-label="新场景名称"
          value={newScene}
          onChange={(e) => setNewScene(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNew();
            }
          }}
          placeholder="新建场景分类（例如：温泉、节日、海岛）"
          className="h-9 bg-background/60"
        />
        <Button size="sm" variant="secondary" onClick={submitNew} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" aria-hidden /> 新建场景
        </Button>
      </div>
    </SectionCard>
  );
}
