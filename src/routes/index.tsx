import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ImageGallery } from "@/components/image-gallery";
import { AspectRatioSelect, ResolutionSelect, ImageModelSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";
import { generateImages, type GeneratedImage } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "文生图 — Grok Studio" },
      { name: "description", content: "通过 xAI Grok Imagine 文本生成高质量图片。" },
    ],
  }),
  component: Index,
});

function Index() {
  const { settings } = useSettings();
  const [prompt, setPrompt] = useState("");
  const [n, setN] = useState(1);
  const [aspect, setAspect] = useState(settings.defaultAspectRatio);
  const [resolution, setResolution] = useState<"1k" | "2k">(settings.defaultResolution);
  const [model, setModel] = useState(settings.imageModel);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("请输入提示词");
    setLoading(true);
    try {
      const data = await generateImages({ prompt, n, aspect_ratio: aspect, resolution, model });
      setImages(data);
      toast.success(`已生成 ${data.length} 张图片`);
      Promise.all(data.map((img) =>
        addGalleryFromUrl(img.url, { prompt, model, sceneName: "文生图" }).catch(() => null),
      ));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader title="文生图" description="输入提示词，让 Grok Imagine 把想象变成画面。" icon={ImageIcon} />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label>提示词</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：赛博朋克风格的东京夜晚，霓虹倒映在湿润街道，雨夜，电影感"
              className="min-h-[180px] resize-none bg-background/60 text-base"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? "生成中…" : "生成图片"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">参数</h3>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">数量 (1–10)</Label>
            <Input type="number" min={1} max={10} value={n} onChange={(e) => setN(Math.min(10, Math.max(1, +e.target.value || 1)))} />
          </div>
          <AspectRatioSelect value={aspect} onChange={setAspect} />
          <ResolutionSelect value={resolution} onChange={(v) => setResolution(v as "1k" | "2k")} />
          <ImageModelSelect value={model} onChange={setModel} />
        </aside>
      </div>

      {(loading || images.length > 0) && (
        <div className="mt-8">
          {loading && images.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : (
            <ImageGallery images={images} prefix="t2i" />
          )}
        </div>
      )}
    </div>
  );
}
