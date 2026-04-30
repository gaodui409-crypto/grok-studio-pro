import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Sparkles, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ImageUpload } from "@/components/image-upload";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import { generateVideo, pollVideo, type VideoStatus } from "@/lib/xai";
import { downloadOne } from "@/lib/download";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "视频生成 — Grok Studio" },
      { name: "description", content: "通过 xAI Grok Imagine 生成高质量短视频。" },
    ],
  }),
  component: VideoPage,
});

function VideoPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(6);
  const [aspect, setAspect] = useState("16:9");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [startImage, setStartImage] = useState<string[]>([]);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("请输入提示词");
    setLoading(true);
    setStatus(null);
    setVideoUrl(null);
    try {
      const { request_id } = await generateVideo({
        prompt,
        duration,
        aspect_ratio: aspect,
        resolution,
        image: startImage[0],
        reference_images: refImages.length ? refImages : undefined,
      });
      toast.info(`任务已提交：${request_id}`);
      const { promise } = pollVideo(request_id, (s) => setStatus(s));
      const final = await promise;
      if (final.status === "done" && final.video?.url) {
        setVideoUrl(final.video.url);
        toast.success("视频生成完成");
      } else {
        toast.error(`任务${final.status === "failed" ? "失败" : "已过期"}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const progress = status?.progress ?? (status?.status === "pending" ? 5 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader title="视频生成" description="文生视频、图生视频，支持参考图（最多 7 张）。" icon={Film} />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label>提示词</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一只机械蝴蝶在霓虹花园中起飞，慢动作，电影感运镜"
              className="min-h-[120px] resize-none bg-background/60"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>起始帧（图生视频，可选）</Label>
              <ImageUpload values={startImage} onChange={setStartImage} max={1} label="上传起始图" />
            </div>
            <div className="space-y-2">
              <Label>参考图（最多 7 张，可选）</Label>
              <ImageUpload values={refImages} onChange={setRefImages} max={7} label="上传参考图" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? "生成中…" : "生成视频"}
            </Button>
          </div>

          {(loading || status) && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-surface/60 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">状态：{status?.status ?? "提交中"}</span>
                <span className="font-mono text-primary-glow">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {videoUrl && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-surface/60 p-4">
              <video src={videoUrl} controls className="w-full rounded-lg" />
              <Button variant="secondary" onClick={() => downloadOne(videoUrl, `grok-video-${Date.now()}.mp4`)}>
                <Download className="mr-2 h-4 w-4" /> 下载视频
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">参数</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">时长</Label>
              <span className="text-sm font-mono text-primary-glow">{duration}s</span>
            </div>
            <Slider min={1} max={15} step={1} value={[duration]} onValueChange={(v) => setDuration(v[0])} />
          </div>
          <AspectRatioSelect value={aspect} onChange={setAspect} />
          <ResolutionSelect value={resolution} onChange={(v) => setResolution(v as "480p" | "720p")} options={["480p", "720p"]} />
        </aside>
      </div>
    </div>
  );
}
