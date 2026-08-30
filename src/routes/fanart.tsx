import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import { ProviderModelSelect, ProviderSelect } from "@/components/provider-model-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/fanart/section-card";
import { CharacterCard } from "@/components/fanart/character-card";
import { SceneTreeCard } from "@/components/fanart/scene-tree-card";
import { StyleCard } from "@/components/fanart/style-card";
import { CostPanel } from "@/components/fanart/cost-panel";
import { RunPanel } from "@/components/fanart/run-panel";
import { PromptPreview } from "@/components/fanart/prompt-preview";
import { RunResults } from "@/components/fanart/run-results";
import type { EditableItem } from "@/components/editable-chip-list";
import { useSettings } from "@/hooks/use-settings";
import { editImages, generateImages, currentProvider, providerLabel } from "@/lib/xai";
import {
  loadSceneTree,
  saveSceneTree,
  newScene,
  DEFAULT_SCENE_TREE,
  type Scene,
  type SceneTreeData,
} from "@/lib/scene-tree";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { runWithConcurrency } from "@/lib/concurrency";
import { BUILTIN_PRESETS, loadCustomPresets, type CharacterPreset } from "@/lib/character-presets";
import {
  useAppStore,
  applyPresetToFanart,
  presetExtraItems,
  type SceneSel,
  type FanartRunItem,
} from "@/lib/app-store";
import type { ResolutionTier } from "@/lib/settings";
import { isAbortError } from "@/lib/http";

export const Route = createFileRoute("/fanart")({
  head: () => ({
    meta: [
      { title: "同人图批量生成 — Grok Studio" },
      { name: "description", content: "按场景层级化批量生成角色同人图，自动保存到画廊。" },
    ],
  }),
  component: FanartPage,
});

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
    "高质量",
    "精细画面",
    "杰作",
  ].filter(Boolean);
  return parts.join("，");
};

const labelOf = (item: PromptItem) =>
  [item.sceneName, item.outfit, item.action].filter(Boolean).join(" · ");

function FanartPage() {
  const { settings, ready: settingsReady } = useSettings();
  const f = useAppStore((s) => s.fanart);
  const setF = useAppStore((s) => s.setFanart);
  const patchF = useAppStore((s) => s.patchFanart);
  const runRef = useRef<AbortController | null>(null);

  const cancelRun = () => runRef.current?.abort();

  // Persistent scene tree (lives in localStorage, separate from per-page store).
  //
  // Starts from DEFAULT_SCENE_TREE, never from loadSceneTree(). Seeding the initial
  // state from localStorage meant the server rendered the default scenes while the
  // browser rendered the saved ones, so React threw a hydration error on every
  // visit for anyone who had ever added or renamed a scene — which is the intended
  // use of this page. Same reasoning as use-settings.ts.
  const [tree, setTree] = useState<SceneTreeData>(DEFAULT_SCENE_TREE);
  const [treeLoaded, setTreeLoaded] = useState(false);
  useEffect(() => {
    setTree(loadSceneTree());
    setTreeLoaded(true);
  }, []);
  useEffect(() => {
    // Guarded: without this, the first post-mount run would write the defaults
    // straight over the tree the load effect is in the middle of restoring.
    if (!treeLoaded) return;
    saveSceneTree(tree);
  }, [tree, treeLoaded]);

  // Custom presets list (rebuilds when settings page changes them). Empty on the
  // first render for the same reason as the scene tree above: read in the effect,
  // not in the initializer, or the saved presets appear in the client's <Select>
  // and not in the server's.
  const [customPresets, setCustomPresets] = useState<CharacterPreset[]>([]);
  useEffect(() => {
    const h = () => setCustomPresets(loadCustomPresets());
    h();
    window.addEventListener("grok-presets-changed", h);
    return () => window.removeEventListener("grok-presets-changed", h);
  }, []);
  const allPresets = useMemo(() => [...BUILTIN_PRESETS, ...customPresets], [customPresets]);

  const {
    presetId,
    charName,
    charDesc,
    refImages,
    sel,
    styleSel,
    lightSel,
    mode,
    activeSceneId,
    aspect,
    resolution,
    model,
    overrides,
    running,
    runItems,
  } = f;

  // Initialize active scene if needed
  useEffect(() => {
    if (!activeSceneId && tree.scenes[0]) {
      setF({ activeSceneId: tree.scenes[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.scenes.length]);

  // helpers ------------------------------------------------------
  const getSel = (sceneId: string): SceneSel =>
    sel[sceneId] ?? { outfits: {}, actions: {}, enabled: false };
  const updateSel = (sceneId: string, patch: Partial<SceneSel>) =>
    patchF((s) => ({
      ...s,
      sel: {
        ...s.sel,
        [sceneId]: {
          ...(s.sel[sceneId] ?? { outfits: {}, actions: {}, enabled: false }),
          ...patch,
        },
      },
    }));

  const updateScene = (id: string, patch: Partial<Scene>) =>
    setTree((t) => ({ ...t, scenes: t.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addScene = (name: string) => {
    const s = newScene(name);
    setTree((t) => ({ ...t, scenes: [...t.scenes, s] }));
    toast.success(`已添加场景：${name}`);
  };
  const removeScene = (id: string) => {
    const scene = tree.scenes.find((s) => s.id === id);
    if (scene && !confirm(`删除场景「${scene.name}」？`)) return;
    setTree((t) => ({ ...t, scenes: t.scenes.filter((s) => s.id !== id) }));
    patchF((s) => {
      const next = { ...s.sel };
      delete next[id];
      return { ...s, sel: next };
    });
  };

  const setSceneItems = (scene: Scene, kind: "outfits" | "actions", items: EditableItem[]) => {
    const values = items.map((i) => i.value);
    const checkMap: Record<string, boolean> = {};
    items.forEach((i) => {
      if (i.checked) checkMap[i.value] = true;
    });
    updateScene(scene.id, { [kind]: values });
    updateSel(scene.id, { [kind]: checkMap, enabled: true });
  };

  // Apply character preset --------------------------------------
  const applyPreset = (id: string) => {
    if (!id) {
      // "custom" — clear
      setF({
        presetId: "",
        charName: "",
        charDesc: "",
        sel: {},
        styleSel: "",
        lightSel: "",
        lastPresetApplied: "",
      });
      return;
    }
    const preset = allPresets.find((p) => p.id === id);
    if (!preset) return;

    // First, augment scene tree with any preset items not yet present
    const extras = presetExtraItems(preset, tree.scenes);
    if (extras.length) {
      setTree((t) => ({
        ...t,
        scenes: t.scenes.map((s) => {
          const extra = extras.find((e) => e.sceneId === s.id);
          if (!extra) return s;
          return {
            ...s,
            outfits: [...s.outfits, ...extra.addOutfits.filter((x) => !s.outfits.includes(x))],
            actions: [...s.actions, ...extra.addActions.filter((x) => !s.actions.includes(x))],
          };
        }),
      }));
    }

    // Apply on the *next* version of the tree — use a microtask to read it back
    queueMicrotask(() => {
      const updatedTree = loadSceneTree();
      applyPresetToFanart(preset, updatedTree.scenes, patchF);
      // ensure style/lighting exist in tree (so chip shows checked)
      if (preset.defaultStyle && !updatedTree.styles.includes(preset.defaultStyle)) {
        setTree((t) => ({ ...t, styles: [...t.styles, preset.defaultStyle!] }));
      }
      if (preset.defaultLighting && !updatedTree.lighting.includes(preset.defaultLighting)) {
        setTree((t) => ({ ...t, lighting: [...t.lighting, preset.defaultLighting!] }));
      }
      toast.success(`已应用预设：${preset.name}`);
    });
  };

  // Build prompts list ------------------------------------------
  const promptItems = useMemo<PromptItem[]>(() => {
    const out: PromptItem[] = [];
    const scenes =
      mode === "single"
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
          const prompt =
            overrides[id] ?? buildPrompt(charDesc, scene.name, outfit, action, styleSel, lightSel);
          out.push({ id, prompt, sceneName: scene.name, outfit, action });
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, sel, mode, activeSceneId, charDesc, styleSel, lightSel, overrides]);

  // Run ---------------------------------------------------------
  const patchItem = (id: string, patch: Partial<FanartRunItem>) =>
    patchF((s) => ({
      ...s,
      runItems: s.runItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const handleRun = async () => {
    if (!charDesc.trim()) return toast.error("请填写角色描述");
    if (!promptItems.length) return toast.error("请至少勾选一个服装或动作");

    const controller = new AbortController();
    runRef.current = controller;
    setF({
      running: true,
      runItems: promptItems.map((item) => ({
        id: item.id,
        label: labelOf(item),
        status: "pending" as const,
      })),
    });

    try {
      await runWithConcurrency(
        promptItems,
        async (item) => {
          controller.signal.throwIfAborted();
          patchItem(item.id, { status: "running" });
          try {
            const data = refImages.length
              ? await editImages({
                  prompt: item.prompt,
                  images: refImages,
                  n: 1,
                  resolution,
                  model,
                  signal: controller.signal,
                })
              : await generateImages({
                  prompt: item.prompt,
                  n: 1,
                  aspect_ratio: aspect,
                  resolution,
                  model,
                  signal: controller.signal,
                });

            const first = data[0];
            if (!first) throw new Error("渠道没有返回图片");

            // The image is shown from its own URL, so a gallery write that fails
            // no longer loses the result: it only costs the archive copy, and the
            // item stays "done" because the generation itself succeeded.
            patchItem(item.id, { status: "done", url: first.url });

            for (const img of data) {
              try {
                await addGalleryFromUrl(img.url, {
                  prompt: item.prompt,
                  sceneName: item.sceneName,
                  outfit: item.outfit,
                  action: item.action,
                  character: charName || charDesc.slice(0, 20),
                  model,
                  provider: providerLabel(currentProvider()),
                });
              } catch (e) {
                console.error("save gallery failed", e);
              }
            }
          } catch (e) {
            if (isAbortError(e)) throw e;
            // No toast per failure: a batch of 24 on a rate-limited channel can
            // fail two dozen times, and 24 stacked toasts bury each other and
            // everything else. The message is kept on the item instead, where it
            // is still readable after the run.
            patchItem(item.id, { status: "failed", error: (e as Error).message });
          }
        },
        settings.concurrency,
      );

      const settled = useAppStore.getState().fanart.runItems;
      const ok = settled.filter((i) => i.status === "done").length;
      const bad = settled.filter((i) => i.status === "failed").length;
      if (bad === 0) toast.success(`批量完成，共 ${ok} 张`);
      else toast.warning(`批量结束：成功 ${ok} 张，失败 ${bad} 张`);
    } catch (e) {
      if (isAbortError(e)) {
        // Anything still queued when the cancel landed never ran, so leaving it
        // "pending" would read as "in progress" forever.
        patchF((s) => ({
          ...s,
          runItems: s.runItems.map((item) =>
            item.status === "pending" || item.status === "running"
              ? { ...item, status: "failed" as const, error: "已取消" }
              : item,
          ),
        }));
        toast.info("已取消批量生成");
      } else toast.error((e as Error).message);
    } finally {
      if (runRef.current === controller) {
        runRef.current = null;
        setF({ running: false });
      }
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <PageHeader
        title="同人图批量生成"
        description="按场景 × 服装 × 动作排出整批图，自动保存到画廊。"
        icon={Sparkles}
      />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <CharacterCard
            step={1}
            presetId={presetId}
            charName={charName}
            charDesc={charDesc}
            refImages={refImages}
            customPresets={customPresets}
            onApplyPreset={applyPreset}
            onChange={setF}
          />

          <SceneTreeCard
            step={2}
            scenes={tree.scenes}
            mode={mode}
            activeSceneId={activeSceneId}
            getSel={getSel}
            onPickActive={(id) => setF({ activeSceneId: id })}
            onRenameScene={(id, name) => updateScene(id, { name })}
            onRemoveScene={removeScene}
            onAddScene={addScene}
            onSetItems={setSceneItems}
            onReset={() => {
              if (confirm("重置为默认场景？所有自定义将丢失。")) setTree(DEFAULT_SCENE_TREE);
            }}
          />

          <StyleCard
            step={3}
            styles={tree.styles}
            lighting={tree.lighting}
            styleSel={styleSel}
            lightSel={lightSel}
            onStyles={(next) => setTree((t) => ({ ...t, styles: next }))}
            onLighting={(next) => setTree((t) => ({ ...t, lighting: next }))}
            onStyleSel={(next) => setF({ styleSel: next })}
            onLightSel={(next) => setF({ lightSel: next })}
          />

          <SectionCard step={4} title="生成模式">
            <Tabs value={mode} onValueChange={(v) => setF({ mode: v as "single" | "multi" })}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">单场景精细</TabsTrigger>
                <TabsTrigger value="multi">多场景混合</TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Description outside TabsContent: as TabsContent it was an empty
                panel on first paint and the text only appeared after hydration
                picked a tab. */}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {mode === "single" ? (
                <>
                  只用
                  <span className="text-foreground">
                    {" "}
                    {tree.scenes.find((s) => s.id === activeSceneId)?.name ?? "未选择"}{" "}
                  </span>
                  一个场景，生成「服装 × 动作」的全部组合。
                </>
              ) : (
                <>用所有勾选过的场景，按场景依次生成。</>
              )}
            </p>
          </SectionCard>

          <SectionCard step={5} title="参数">
            <div className="grid gap-4 sm:grid-cols-2">
              <AspectRatioSelect value={aspect} onChange={(v) => setF({ aspect: v })} />
              <ResolutionSelect
                value={resolution}
                onChange={(v) => setF({ resolution: v as ResolutionTier })}
              />
              <ProviderSelect />
              <ProviderModelSelect />
            </div>
          </SectionCard>
        </div>

        {/* Sticky: the cost figure and the run button are what you come back to
            after every edit on the left, and the left column is several screens
            tall. */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* provider comes from the settings hook, never from currentProvider():
              that reads localStorage, so calling it during render made the server
              price the batch as xAI while the client priced it as whatever channel
              you actually chose. See the comment in use-settings.ts. */}
          <CostPanel
            count={promptItems.length}
            provider={settings.provider}
            model={model}
            concurrency={settings.concurrency}
            ready={settingsReady}
          />
          <RunPanel
            count={promptItems.length}
            running={running}
            items={runItems}
            onRun={handleRun}
            onCancel={cancelRun}
          />
          <PromptPreview
            items={promptItems}
            overrides={overrides}
            onOverride={(id, prompt) => setF({ overrides: { ...overrides, [id]: prompt } })}
            onClearOverride={(id) => {
              const next = { ...overrides };
              delete next[id];
              setF({ overrides: next });
            }}
            onResetAll={() => setF({ overrides: {} })}
          />
        </aside>
      </div>

      <RunResults items={runItems} aspect={aspect} />
    </div>
  );
}
