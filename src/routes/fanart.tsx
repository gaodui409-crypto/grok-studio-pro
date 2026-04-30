import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Loader2, Plus, Trash2, Pencil, Check, X,
  ChevronDown, RotateCcw, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ImageUpload } from "@/components/image-upload";
import {
  AspectRatioSelect, ResolutionSelect, ImageModelSelect,
} from "@/components/param-selects";
import { EditableChipList, type EditableItem } from "@/components/editable-chip-list";
import { useSettings } from "@/hooks/use-settings";
import { editImages, generateImages } from "@/lib/xai";
import {
  loadSceneTree, saveSceneTree, newScene, DEFAULT_SCENE_TREE,
  type Scene, type SceneTreeData,
} from "@/lib/scene-tree";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fanart")({
  head: () => ({
    meta: [
      { title: "同人图批量生成 — Grok Studio" },
      { name: "description", content: "按场景层级化批量生成角色同人图，自动保存到画廊。" },
    ],
  }),
  component: FanartPage,
});

const PRICE_PER_IMAGE = 0.07;

type SceneSel = {
  // selected outfits / actions per scene id
  outfits: Record<string, boolean>;
  actions: Record<string, boolean>;
  enabled: boolean;
};

type Selections = Record<string, SceneSel>;

type PromptItem = {
  id: string;
  prompt: string;
  sceneName: string;
  outfit: string;
  action: string;
};

const buildPrompt = (
  charDesc: string,
  sceneName: string,
  outfit: string,
  action: string,
  style: string,
  lighting: string,
) => {
  const parts = [
    charDesc.trim(),
    outfit && `穿${outfit}`,
    action,
    sceneName && `${sceneName}场景`,
    style,
    lighting,
    "高质量", "精细画面", "杰作",
  ].filter(Boolean);
  return parts.join("，");
};

function FanartPage() {
  const { settings } = useSettings();

  // Persistent scene tree
  const [tree, setTree] = useState<SceneTreeData>(loadSceneTree);
  useEffect(() => { saveSceneTree(tree); }, [tree]);

  // Character
  const [charName, setCharName] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const [refImages, setRefImages] = useState<string[]>([]);

  // Selection state per scene
  const [sel, setSel] = useState<Selections>({});
  // global single-pick style/lighting (store value, "" = none)
  const [styleSel, setStyleSel] = useState<string>("");
  const [lightSel, setLightSel] = useState<string>("");

  // Generation params
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [activeSceneId, setActiveSceneId] = useState<string>(tree.scenes[0]?.id ?? "");
  const [aspect, setAspect] = useState(settings.defaultAspectRatio);
  const [resolution, setResolution] = useState<"1k" | "2k">(settings.defaultResolution);
  const [model, setModel] = useState(settings.imageModel);

  // Editing scene name
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingSceneName, setEditingSceneName] = useState("");
  const [newSceneInput, setNewSceneInput] = useState("");

  // Manual prompt overrides: id -> overridden prompt text
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptVal, setEditingPromptVal] = useState("");

  // Generation
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  // helpers ------------------------------------------------------
  const getSel = (sceneId: string): SceneSel => sel[sceneId] ?? { outfits: {}, actions: {}, enabled: false };
  const updateSel = (sceneId: string, patch: Partial<SceneSel>) =>
    setSel((p) => ({ ...p, [sceneId]: { ...getSel(sceneId), ...patch } }));

  const toggleItem = (sceneId: string, kind: "outfits" | "actions", value: string) => {
    const s = getSel(sceneId);
    const map = { ...s[kind], [value]: !s[kind][value] };
    updateSel(sceneId, { [kind]: map, enabled: true });
  };

  const updateScene = (id: string, patch: Partial<Scene>) =>
    setTree((t) => ({ ...t, scenes: t.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addScene = () => {
    const name = newSceneInput.trim() || "新场景";
    const s = newScene(name);
    setTree((t) => ({ ...t, scenes: [...t.scenes, s] }));
    setNewSceneInput("");
    toast.success(`已添加场景：${name}`);
  };
  const removeScene = (id: string) => {
    setTree((t) => ({ ...t, scenes: t.scenes.filter((s) => s.id !== id) }));
    setSel((p) => {
      const next = { ...p }; delete next[id]; return next;
    });
  };

  // chip helpers for outfits/actions inside a scene
  const sceneItemsAs = (scene: Scene, kind: "outfits" | "actions"): EditableItem[] => {
    const checks = getSel(scene.id)[kind];
    return scene[kind].map((v) => ({ value: v, checked: !!checks[v] }));
  };
  const setSceneItems = (scene: Scene, kind: "outfits" | "actions", items: EditableItem[]) => {
    const values = items.map((i) => i.value);
    const checkMap: Record<string, boolean> = {};
    items.forEach((i) => { if (i.checked) checkMap[i.value] = true; });
    updateScene(scene.id, { [kind]: values });
    updateSel(scene.id, { [kind]: checkMap, enabled: true });
  };

  // global style/lighting as single-pick chip lists
  const styleItems: EditableItem[] = tree.styles.map((v) => ({ value: v, checked: v === styleSel }));
  const lightItems: EditableItem[] = tree.lighting.map((v) => ({ value: v, checked: v === lightSel }));

  // Build prompts list ------------------------------------------
  const promptItems = useMemo<PromptItem[]>(() => {
    const out: PromptItem[] = [];
    const scenes = mode === "single"
      ? tree.scenes.filter((s) => s.id === activeSceneId)
      : tree.scenes.filter((s) => getSel(s.id).enabled);

    scenes.forEach((scene) => {
      const s = getSel(scene.id);
      const outfits = scene.outfits.filter((o) => s.outfits[o]);
      const actions = scene.actions.filter((a) => s.actions[a]);
      const outfitArr = outfits.length ? outfits : [""];
      const actionArr = actions.length ? actions : [""];
      outfitArr.forEach((outfit) => {
        actionArr.forEach((action) => {
          if (!outfit && !action) return;
          const id = `${scene.id}::${outfit}::${action}`;
          const prompt = overrides[id] ?? buildPrompt(charDesc, scene.name, outfit, action, styleSel, lightSel);
          out.push({ id, prompt, sceneName: scene.name, outfit, action });
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, sel, mode, activeSceneId, charDesc, styleSel, lightSel, overrides]);

  const totalCost = (promptItems.length * PRICE_PER_IMAGE).toFixed(2);

  // Run ---------------------------------------------------------
  const handleRun = async () => {
    if (!charDesc.trim()) return toast.error("请填写角色描述");
    if (!promptItems.length) return toast.error("请至少勾选一个服装或动作");

    setRunning(true);
    setDone(0);
    setCurrentPrompt("");
    let success = 0;
    let idx = 0;
    const concurrency = 3;

    const worker = async () => {
      while (idx < promptItems.length) {
        const my = idx++;
        const item = promptItems[my];
        setCurrentPrompt(item.prompt);
        try {
          const data = refImages.length
            ? await editImages({ prompt: item.prompt, images: refImages, n: 1, resolution, model })
            : await generateImages({ prompt: item.prompt, n: 1, aspect_ratio: aspect, resolution, model });
          for (const img of data) {
            try {
              await addGalleryFromUrl(img.url, {
                prompt: item.prompt,
                sceneName: item.sceneName,
                outfit: item.outfit,
                action: item.action,
                character: charName || charDesc.slice(0, 20),
                model,
              });
              success++;
            } catch (e) {
              console.error("save gallery failed", e);
            }
          }
        } catch (e) {
          toast.error(`「${item.sceneName} · ${item.action || item.outfit}」失败：${(e as Error).message}`);
        } finally {
          setDone((d) => d + 1);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: concurrency }, worker));
      toast.success(`批量完成，已保存到画廊 ${success} 张`);
    } finally {
      setRunning(false);
      setCurrentPrompt("");
    }
  };

  // ============================================================
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <PageHeader
        title="同人图批量生成"
        description="按场景 → 服装 → 动作的层级精细批量生成；图片自动保存到画廊。"
        icon={Sparkles}
      />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ============== LEFT ============== */}
        <div className="space-y-6">
          {/* Character */}
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              角色设定
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>角色名（用于画廊筛选）</Label>
                <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="例如：白雪" />
              </div>
              <div className="space-y-2">
                <Label>参考图（1–3 张，可选）</Label>
                <ImageUpload values={refImages} onChange={setRefImages} max={3} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>角色描述</Label>
              <Textarea
                value={charDesc}
                onChange={(e) => setCharDesc(e.target.value)}
                placeholder="例如：银发红瞳的少女，气质冷艳，腰间别着短刃"
                className="min-h-[80px] resize-none bg-background/60"
              />
            </div>
          </section>

          {/* Scene tree */}
          <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                场景树
              </h3>
              <Button
                size="sm" variant="ghost"
                onClick={() => { if (confirm("重置为默认场景？所有自定义将丢失。")) setTree(DEFAULT_SCENE_TREE); }}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> 重置
              </Button>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {tree.scenes.map((scene) => {
                const s = getSel(scene.id);
                const checkedCount =
                  Object.values(s.outfits).filter(Boolean).length +
                  Object.values(s.actions).filter(Boolean).length;
                const isActive = mode === "single" && activeSceneId === scene.id;

                return (
                  <AccordionItem
                    key={scene.id}
                    value={scene.id}
                    className={cn(
                      "rounded-xl border border-border/60 bg-surface/40 px-3 transition",
                      isActive && "border-primary/60 shadow-[0_0_14px_oklch(0.65_0.21_285/0.2)]",
                    )}
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                        {editingSceneId === scene.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              autoFocus
                              value={editingSceneName}
                              onChange={(e) => setEditingSceneName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); updateScene(scene.id, { name: editingSceneName.trim() || scene.name }); setEditingSceneId(null); }
                                if (e.key === "Escape") setEditingSceneId(null);
                              }}
                              className="h-7 w-44 text-sm"
                            />
                            <button
                              onClick={() => { updateScene(scene.id, { name: editingSceneName.trim() || scene.name }); setEditingSceneId(null); }}
                              className="text-success"
                            ><Check className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <span className="text-base font-semibold">{scene.name}</span>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {checkedCount > 0 && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary-glow">
                              已选 {checkedCount}
                            </span>
                          )}
                          {mode === "single" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveSceneId(scene.id); }}
                              className={cn(
                                "rounded-full border px-2 py-0.5 transition",
                                isActive
                                  ? "border-primary/60 bg-primary/20 text-primary-glow"
                                  : "border-border/60 hover:border-primary/40",
                              )}
                            >
                              {isActive ? "当前生成" : "选为生成场景"}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSceneId(scene.id); setEditingSceneName(scene.name); }}
                            className="opacity-60 hover:opacity-100"
                          ><Pencil className="h-3.5 w-3.5" /></button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`删除场景「${scene.name}」？`)) removeScene(scene.id); }}
                            className="opacity-60 hover:text-destructive hover:opacity-100"
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4 pt-1">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">服装</Label>
                        <EditableChipList
                          items={sceneItemsAs(scene, "outfits")}
                          onChange={(items) => setSceneItems(scene, "outfits", items)}
                          placeholder="添加服装…"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">动作</Label>
                        <EditableChipList
                          items={sceneItemsAs(scene, "actions")}
                          onChange={(items) => setSceneItems(scene, "actions", items)}
                          placeholder="添加动作…"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="flex gap-2 pt-2">
              <Input
                value={newSceneInput}
                onChange={(e) => setNewSceneInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addScene())}
                placeholder="新建场景分类（例如：温泉、节日、海岛）"
                className="h-9 bg-background/60"
              />
              <Button size="sm" variant="secondary" onClick={addScene}>
                <Plus className="mr-1 h-4 w-4" /> 新建场景
              </Button>
            </div>
          </section>

          {/* Global style / lighting */}
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              全局设定 <span className="ml-2 normal-case tracking-normal text-foreground/50 text-xs">单选 · 可留空</span>
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">画风</Label>
                <button
                  type="button"
                  onClick={() => setStyleSel("")}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition",
                    styleSel === ""
                      ? "border-primary/60 bg-primary/20 text-primary-glow"
                      : "border-border/60 text-muted-foreground hover:border-primary/40",
                  )}
                >无（让 AI 自由发挥）</button>
              </div>
              <EditableChipList
                multi={false}
                items={styleItems}
                onChange={(items) => {
                  setTree((t) => ({ ...t, styles: items.map((i) => i.value) }));
                  const picked = items.find((i) => i.checked)?.value ?? "";
                  setStyleSel(picked);
                }}
                placeholder="添加画风…"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">光影氛围</Label>
                <button
                  type="button"
                  onClick={() => setLightSel("")}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition",
                    lightSel === ""
                      ? "border-primary/60 bg-primary/20 text-primary-glow"
                      : "border-border/60 text-muted-foreground hover:border-primary/40",
                  )}
                >无（让 AI 自由发挥）</button>
              </div>
              <EditableChipList
                multi={false}
                items={lightItems}
                onChange={(items) => {
                  setTree((t) => ({ ...t, lighting: items.map((i) => i.value) }));
                  const picked = items.find((i) => i.checked)?.value ?? "";
                  setLightSel(picked);
                }}
                placeholder="添加光影…"
              />
            </div>
          </section>
        </div>

        {/* ============== RIGHT ============== */}
        <aside className="space-y-4">
          <div className="sticky top-20 space-y-4">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                生成控制
              </h3>

              <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multi")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">单场景精细</TabsTrigger>
                  <TabsTrigger value="multi">多场景混合</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="pt-2 text-xs text-muted-foreground">
                  当前场景：<span className="text-foreground">{tree.scenes.find((s) => s.id === activeSceneId)?.name ?? "未选择"}</span>。
                  生成「服装 × 动作」全组合。
                </TabsContent>
                <TabsContent value="multi" className="pt-2 text-xs text-muted-foreground">
                  使用所有展开过/勾选过的场景，按场景依次生成。
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-3">
                <AspectRatioSelect value={aspect} onChange={setAspect} />
                <ResolutionSelect value={resolution} onChange={(v) => setResolution(v as "1k" | "2k")} />
              </div>
              <ImageModelSelect value={model} onChange={setModel} />

              <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">将生成</span>
                  <span className="font-mono text-primary-glow">{promptItems.length} 张</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">预估费用</span>
                  <span className="font-mono">${totalCost}</span>
                </div>
              </div>

              {running && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">进度</span>
                    <span className="font-mono text-primary-glow">{done}/{promptItems.length}</span>
                  </div>
                  <Progress value={promptItems.length ? (done / promptItems.length) * 100 : 0} />
                  {currentPrompt && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">正在生成：{currentPrompt}</p>
                  )}
                </div>
              )}

              <Button
                onClick={handleRun}
                disabled={running || !promptItems.length}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {running ? "批量生成中…" : `开始批量生成 · ${promptItems.length} 张`}
              </Button>
            </div>

            {/* Prompt preview */}
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  提示词预览
                </h3>
                {Object.keys(overrides).length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setOverrides({})}>
                    <RotateCcw className="mr-1 h-3 w-3" /> 重置编辑
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[420px] pr-2">
                {promptItems.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">勾选服装与动作以预览提示词</p>
                ) : (
                  <ul className="space-y-2">
                    {promptItems.map((p, idx) => (
                      <li key={p.id} className="rounded-lg border border-border/60 bg-surface/40 p-2.5 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-primary-glow">#{idx + 1}</span>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span>{p.sceneName}</span>
                            {editingPromptId === p.id ? (
                              <button onClick={() => {
                                setOverrides((o) => ({ ...o, [p.id]: editingPromptVal }));
                                setEditingPromptId(null);
                              }}><Check className="h-3.5 w-3.5 text-success" /></button>
                            ) : (
                              <button
                                onClick={() => { setEditingPromptId(p.id); setEditingPromptVal(p.prompt); }}
                                className="hover:text-foreground"
                              ><Wand2 className="h-3 w-3" /></button>
                            )}
                            {overrides[p.id] && (
                              <button
                                onClick={() => setOverrides((o) => { const n = { ...o }; delete n[p.id]; return n; })}
                                className="hover:text-destructive"
                              ><X className="h-3 w-3" /></button>
                            )}
                          </div>
                        </div>
                        {editingPromptId === p.id ? (
                          <Textarea
                            value={editingPromptVal}
                            onChange={(e) => setEditingPromptVal(e.target.value)}
                            className="min-h-[80px] resize-none bg-background/60 text-xs"
                            autoFocus
                          />
                        ) : (
                          <p className="break-words leading-relaxed text-foreground/85">{p.prompt}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
