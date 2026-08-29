import { createFileRoute } from "@tanstack/react-router";
import { Film, Sparkles, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ProviderUnsupportedBanner } from "@/components/provider-banner";
import { ImageUpload } from "@/components/image-upload";
import { AspectRatioSelect, ResolutionSelect, VideoModelSelect } from "@/components/param-selects";
import { generateVideo, editVideo, extendVideo, pollVideo, fileToDataUri } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { downloadOne } from "@/lib/download";
import { useAppStore, type VideoSubMode } from "@/lib/app-store";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "视频生成 — Grok Studio" },
      { name: "description", content: "通过 xAI Grok Imagine 生成、编辑、延长高质量短视频。" },
    ],
  }),
  component: VideoPage,
});

const SUB_LABEL: Record<VideoSubMode, string> = {
  t2v: "文生视频",
  i2v: "图生视频",
  edit: "视频编辑",
  extend: "视频延长",
};

function VideoPage() {
  const v = useAppStore((s) => s.video);
  const set = useAppStore((s) => s.setVideo);
  const {
    subMode,
    prompt,
    duration,
    extendDuration,
    aspect,
    resolution,
    model,
    startImage,
    refImages,
    sourceVideoUrl,
    sourceVideoDataUri,
    sourceVideoName,
    loading,
    status,
    videoUrl,
  } = v;

  const onSourceFile = async (f: File | null) => {
    if (!f) {
      set({ sourceVideoDataUri: "", sourceVideoName: "" });
      return;
    }
    const uri = await fileToDataUri(f);
    set({ sourceVideoDataUri: uri, sourceVideoName: f.name });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("请输入提示词");
    if ((subMode === "edit" || subMode === "extend") && !sourceVideoUrl && !sourceVideoDataUri) {
      return toast.error("请先上传或填入源视频 URL");
    }
    if (subMode === "i2v" && !startImage.length) {
      return toast.error("图生视频请上传起始帧图片");
    }

    set({ loading: true, status: null, videoUrl: null });
    try {
      const videoSrc = sourceVideoDataUri || sourceVideoUrl.trim();
      let request_id: string;
      let usedDuration = duration;
      if (subMode === "t2v") {
        ({ request_id } = await generateVideo({
          prompt,
          duration,
          aspect_ratio: aspect,
          resolution,
          model,
        }));
      } else if (subMode === "i2v") {
        ({ request_id } = await generateVideo({
          prompt,
          duration,
          aspect_ratio: aspect,
          resolution,
          model,
          image: startImage[0],
          reference_images: refImages.length ? refImages : undefined,
        }));
      } else if (subMode === "edit") {
        ({ request_id } = await editVideo({ prompt, video: videoSrc, model }));
      } else {
        usedDuration = extendDuration;
        ({ request_id } = await extendVideo({
          prompt,
          video: videoSrc,
          duration: extendDuration,
          model,
        }));
      }

      toast.info(`任务已提交：${request_id}`);
      const { promise } = pollVideo(request_id, (s) => set({ status: s }));
      const final = await promise;
      if (final.status === "done" && final.video?.url) {
        set({ videoUrl: final.video.url });
        toast.success("视频生成完成");
        addGalleryFromUrl(final.video.url, {
          prompt,
          model,
          sceneName: SUB_LABEL[subMode],
          type: "video",
          duration: final.video.duration ?? usedDuration,
          provider: "xAI/NewAPI",
        })
          .then(() => toast.success("已保存到画廊"))
          .catch((e) => toast.error(`画廊保存失败：${(e as Error).message}（可手动下载）`));
      } else {
        toast.error(`任务${final.status === "failed" ? "失败" : "已过期"}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ loading: false });
    }
  };

  const progress = status?.progress ?? (status?.status === "pending" ? 5 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader
        title="视频生成"
        description="文生视频 / 图生视频 / 视频编辑 / 视频延长，全部支持自动保存到画廊。"
        icon={Film}
      />
      <ApiKeyBanner />
      <ProviderUnsupportedBanner feature="video" />

      <Tabs
        value={subMode}
        onValueChange={(val) => set({ subMode: val as VideoSubMode })}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="t2v">文生视频</TabsTrigger>
          <TabsTrigger value="i2v">图生视频</TabsTrigger>
          <TabsTrigger value="edit">视频编辑</TabsTrigger>
          <TabsTrigger value="extend">视频延长</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label>提示词</Label>
            <Textarea
              value={prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder={
                subMode === "extend"
                  ? "描述视频接下来发生的内容，例如：镜头慢慢推近，主角抬头微笑"
                  : subMode === "edit"
                    ? "描述要对视频进行的修改"
                    : "例如：一只机械蝴蝶在霓虹花园中起飞，慢动作，电影感运镜"
              }
              className="min-h-[120px] resize-none bg-background/60"
            />
          </div>

          {subMode === "i2v" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>起始帧（必需）</Label>
                <ImageUpload
                  values={startImage}
                  onChange={(v) => set({ startImage: v })}
                  max={1}
                  label="上传起始图"
                />
              </div>
              <div className="space-y-2">
                <Label>参考图（最多 7 张，可选）</Label>
                <ImageUpload
                  values={refImages}
                  onChange={(v) => set({ refImages: v })}
                  max={7}
                  label="上传参考图"
                />
              </div>
            </div>
          )}

          {(subMode === "edit" || subMode === "extend") && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>源视频文件（mp4，2–15 秒）</Label>
                <Input
                  type="file"
                  accept="video/mp4"
                  onChange={(e) => onSourceFile(e.target.files?.[0] ?? null)}
                />
                {sourceVideoDataUri && (
                  <>
                    <p className="text-xs text-muted-foreground">已加载：{sourceVideoName}</p>
                    <video
                      src={sourceVideoDataUri}
                      controls
                      className="w-full rounded-lg border border-border/60"
                    />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>或：粘贴视频 URL</Label>
                <Input
                  value={sourceVideoUrl}
                  onChange={(e) => set({ sourceVideoUrl: e.target.value })}
                  placeholder="https://…/video.mp4"
                />
              </div>
              {subMode === "extend" && (
                <p className="text-xs text-muted-foreground">
                  提示：延长部分 {extendDuration} 秒 + 原视频长度 = 最终视频长度。
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {loading ? "生成中…" : `执行 · ${SUB_LABEL[subMode]}`}
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
              <Button
                variant="secondary"
                onClick={() => downloadOne(videoUrl, `grok-video-${Date.now()}.mp4`)}
              >
                <Download className="mr-2 h-4 w-4" /> 下载视频
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            参数
          </h3>

          {subMode === "extend" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  延长时长
                </Label>
                <span className="text-sm font-mono text-primary-glow">{extendDuration}s</span>
              </div>
              <Slider
                min={2}
                max={10}
                step={1}
                value={[extendDuration]}
                onValueChange={(v) => set({ extendDuration: v[0] })}
              />
              <p className="text-[11px] text-muted-foreground">
                范围 2–10 秒，输出比例和分辨率继承源视频
              </p>
            </div>
          ) : subMode === "edit" ? (
            <p className="text-xs text-muted-foreground">视频编辑模式输出继承源视频参数。</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    时长
                  </Label>
                  <span className="text-sm font-mono text-primary-glow">{duration}s</span>
                </div>
                <Slider
                  min={1}
                  max={15}
                  step={1}
                  value={[duration]}
                  onValueChange={(v) => set({ duration: v[0] })}
                />
              </div>
              <AspectRatioSelect value={aspect} onChange={(v) => set({ aspect: v })} />
              <ResolutionSelect
                value={resolution}
                onChange={(v) => set({ resolution: v as "480p" | "720p" })}
                options={["480p", "720p"]}
              />
            </>
          )}

          <VideoModelSelect value={model} onChange={(v) => set({ model: v })} />
        </aside>
      </div>
    </div>
  );
}
