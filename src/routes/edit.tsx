import { createFileRoute } from "@tanstack/react-router";
import { Wand2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ProviderUnsupportedBanner } from "@/components/provider-banner";
import { ImageGallery } from "@/components/image-gallery";
import { ImageUpload } from "@/components/image-upload";
import { ResolutionSelect, ImageModelSelect } from "@/components/param-selects";
import { editImages, currentProvider, providerLabel } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/edit")({
  head: () => ({
    meta: [
      { title: "图生图 — Grok Studio" },
      { name: "description", content: "上传图片，让 Grok Imagine 进行图片编辑或多图融合。" },
    ],
  }),
  component: EditPage,
});

function EditPage() {
  const i2i = useAppStore((s) => s.i2i);
  const set = useAppStore((s) => s.setI2I);
  const { images, prompt, n, resolution, model, loading, results } = i2i;

  const handleGenerate = async () => {
    if (!images.length) return toast.error("请上传至少一张图片");
    if (!prompt.trim()) return toast.error("请输入编辑指令");
    set({ loading: true });
    try {
      const data = await editImages({ prompt, images, n, resolution, model });
      set({ results: data });
      toast.success(`已生成 ${data.length} 张图片`);
      Promise.all(data.map((img) =>
        addGalleryFromUrl(img.url, { prompt, model, sceneName: "图生图", provider: providerLabel(currentProvider()) }),
      ))
        .then(() => toast.success("已自动保存到画廊"))
        .catch((e) => toast.error(`画廊保存失败：${(e as Error).message}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ loading: false });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader title="图生图 / 编辑" description="单图编辑或多图融合。多图模式下可在提示词中用 <IMAGE_0>、<IMAGE_1> 引用。" icon={Wand2} />
      <ApiKeyBanner />
      <ProviderUnsupportedBanner feature="i2i" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label>参考图（最多 4 张）</Label>
            <ImageUpload values={images} onChange={(v) => set({ images: v })} max={4} />
          </div>
          <div className="space-y-2">
            <Label>编辑指令</Label>
            <Textarea
              value={prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder={
                images.length > 1
                  ? "例如：把 <IMAGE_0> 中的人物放到 <IMAGE_1> 的背景里，统一光影"
                  : "例如：把背景换成樱花飘落的黄昏，保持人物不变"
              }
              className="min-h-[140px] resize-none bg-background/60"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? "生成中…" : "生成"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">参数</h3>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">数量 (1–10)</Label>
            <Input type="number" min={1} max={10} value={n} onChange={(e) => set({ n: Math.min(10, Math.max(1, +e.target.value || 1)) })} />
          </div>
          <ResolutionSelect value={resolution} onChange={(v) => set({ resolution: v as "1k" | "2k" })} />
          <ImageModelSelect value={model} onChange={(v) => set({ model: v })} />
        </aside>
      </div>

      {(loading || results.length > 0) && (
        <div className="mt-8">
          {loading && results.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : (
            <ImageGallery images={results} prefix="i2i" />
          )}
        </div>
      )}
    </div>
  );
}
