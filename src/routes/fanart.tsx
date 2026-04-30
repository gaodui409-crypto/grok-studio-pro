import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Loader2, Plus, X, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ImageGallery } from "@/components/image-gallery";
import { ImageUpload } from "@/components/image-upload";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";
import { editImages, generateImages, type GeneratedImage } from "@/lib/xai";
import { FANART_DIMENSIONS, type DimensionKey } from "@/lib/fanart-presets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fanart")({
  head: () => ({
    meta: [
      { title: "同人图批量生成 — Grok Studio" },
      { name: "description", content: "为动漫/游戏角色批量生成多场景多风格的同人图。" },
    ],
  }),
  component: FanartPage,
});

type Selections = Record<DimensionKey, Set<string>>;

const initSelections = (): Selections => {
  const s = {} as Selections;
  (Object.keys(FANART_DIMENSIONS) as DimensionKey[]).forEach((k) => {
    // pre-select first 8 of each dimension as a sensible default
    s[k] = new Set(FANART_DIMENSIONS[k].options.slice(0, 8));
  });
  return s;
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function buildPrompt(charDesc: string, sel: Selections, customs: Record<DimensionKey, string[]>) {
  const parts: string[] = [];
  if (charDesc.trim()) parts.push(charDesc.trim());
  (Object.keys(FANART_DIMENSIONS) as DimensionKey[]).forEach((k) => {
    const merged = [...sel[k], ...customs[k]];
    if (merged.length) parts.push(pick(merged));
  });
  parts.push("高质量", "精细画面", "杰作");
  return parts.join("，");
}

function FanartPage() {
  const { settings } = useSettings();
  const [charName, setCharName] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [sel, setSel] = useState<Selections>(initSelections);
  const [customs, setCustoms] = useState<Record<DimensionKey, string[]>>({
    poses: [], scenes: [], styles: [], lighting: [], outfits: [],
  });
  const [customInputs, setCustomInputs] = useState<Record<DimensionKey, string>>({
    poses: "", scenes: "", styles: "", lighting: "", outfits: "",
  });
  const [batchCount, setBatchCount] = useState(8);
  const [aspect, setAspect] = useState(settings.defaultAspectRatio);
  const [resolution, setResolution] = useState<"1k" | "2k">(settings.defaultResolution);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<GeneratedImage[]>([]);

  const toggle = (k: DimensionKey, v: string) => {
    setSel((prev) => {
      const next = new Set(prev[k]);
      if (next.has(v)) next.delete(v); else next.add(v);
      return { ...prev, [k]: next };
    });
  };
  const addCustom = (k: DimensionKey) => {
    const v = customInputs[k].trim();
    if (!v) return;
    setCustoms((p) => ({ ...p, [k]: [...p[k], v] }));
    setCustomInputs((p) => ({ ...p, [k]: "" }));
  };
  const removeCustom = (k: DimensionKey, i: number) => {
    setCustoms((p) => ({ ...p, [k]: p[k].filter((_, idx) => idx !== i) }));
  };

  const previewPrompt = useMemo(
    () => buildPrompt(charDesc, sel, customs),
    [charDesc, sel, customs],
  );

  const handleRun = async () => {
    if (!charDesc.trim()) return toast.error("请填写角色描述");
    setRunning(true);
    setDone(0);
    setResults([]);

    const prompts = Array.from({ length: batchCount }, () => buildPrompt(charDesc, sel, customs));
    const concurrency = 3;
    const all: GeneratedImage[] = [];
    let idx = 0;

    const worker = async () => {
      while (idx < prompts.length) {
        const my = idx++;
        try {
          const data = refImages.length
            ? await editImages({ prompt: prompts[my], images: refImages, n: 1, resolution })
            : await generateImages({ prompt: prompts[my], n: 1, aspect_ratio: aspect, resolution });
          all.push(...data);
          setResults([...all]);
        } catch (e) {
          toast.error(`第 ${my + 1} 张失败：${(e as Error).message}`);
        } finally {
          setDone((d) => d + 1);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: concurrency }, worker));
      toast.success(`批量完成，共 ${all.length} 张`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader
        title="同人图批量生成"
        description="为你喜欢的角色一键生成多场景、多风格的同人图作品集。"
        icon={Sparkles}
      />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left main panel */}
        <div className="space-y-6">
          {/* Character setup */}
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">角色设定</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>角色名（可选）</Label>
                <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="例如：白雪" />
              </div>
              <div className="space-y-2">
                <Label>批量数量</Label>
                <div className="flex items-center gap-3">
                  <Slider min={1} max={50} step={1} value={[batchCount]} onValueChange={(v) => setBatchCount(v[0])} className="flex-1" />
                  <span className="w-10 text-right font-mono text-primary-glow">{batchCount}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>角色描述</Label>
              <Textarea
                value={charDesc}
                onChange={(e) => setCharDesc(e.target.value)}
                placeholder="例如：银发红瞳的少女，穿黑色哥特裙，戴蕾丝头饰，气质冷艳"
                className="min-h-[90px] resize-none bg-background/60"
              />
            </div>
            <div className="space-y-2">
              <Label>参考图（1–3 张，可选；上传后将走图生图模式以保持角色一致性）</Label>
              <ImageUpload values={refImages} onChange={setRefImages} max={3} />
            </div>
          </section>

          {/* Dimensions */}
          {(Object.keys(FANART_DIMENSIONS) as DimensionKey[]).map((k) => {
            const dim = FANART_DIMENSIONS[k];
            return (
              <section key={k} className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {dim.label} <span className="ml-2 normal-case tracking-normal text-foreground/60">已选 {sel[k].size + customs[k].length}</span>
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSel((p) => ({ ...p, [k]: new Set(dim.options) }))}>全选</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSel((p) => ({ ...p, [k]: new Set() }))}>清空</Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dim.options.map((opt) => {
                    const active = sel[k].has(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggle(k, opt)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          active
                            ? "border-primary/60 bg-primary/15 text-foreground shadow-[0_0_12px_oklch(0.65_0.21_285/0.3)]"
                            : "border-border/60 bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                  {customs[k].map((c, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 border-primary/40 bg-primary/15 text-foreground">
                      {c}
                      <button onClick={() => removeCustom(k, i)} className="ml-1 opacity-70 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Input
                    value={customInputs[k]}
                    onChange={(e) => setCustomInputs((p) => ({ ...p, [k]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom(k))}
                    placeholder={`添加自定义${dim.label}…`}
                    className="h-9 bg-background/60 text-sm"
                  />
                  <Button size="sm" variant="secondary" onClick={() => addCustom(k)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        {/* Right sticky control panel */}
        <aside className="space-y-4">
          <div className="sticky top-20 space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">参数</h3>
            <AspectRatioSelect value={aspect} onChange={setAspect} />
            <ResolutionSelect value={resolution} onChange={(v) => setResolution(v as "1k" | "2k")} />

            <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-surface/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Shuffle className="h-3.5 w-3.5" /> 提示词预览
                </Label>
              </div>
              <p className="break-words text-xs leading-relaxed text-foreground/80">{previewPrompt || "—"}</p>
            </div>

            {running && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">进度</span>
                  <span className="font-mono text-primary-glow">{done}/{batchCount}</span>
                </div>
                <Progress value={(done / batchCount) * 100} />
              </div>
            )}

            <Button
              onClick={handleRun}
              disabled={running}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {running ? "批量生成中…" : `开始批量生成 · ${batchCount} 张`}
            </Button>
          </div>
        </aside>
      </div>

      {results.length > 0 && (
        <div className="mt-8">
          <ImageGallery images={results} prefix={`fanart-${charName || "char"}`} />
        </div>
      )}
    </div>
  );
}
