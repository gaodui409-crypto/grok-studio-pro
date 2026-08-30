import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Film, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ProviderUnsupportedBanner } from "@/components/provider-banner";
import { ImageUpload } from "@/components/image-upload";
import { SubModeTabs } from "@/components/video/sub-mode-tabs";
import { SourceVideoInput } from "@/components/video/source-video-input";
import { TaskProgress } from "@/components/video/task-progress";
import { VideoParams } from "@/components/video/video-params";
import { VideoResult } from "@/components/video/video-result";
import { useSettings } from "@/hooks/use-settings";
import { generateVideo, editVideo, extendVideo, pollVideo, fileToDataUri } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { useAppStore, type VideoSubMode } from "@/lib/app-store";
import { SUB_MODE_LABEL, activeDuration, submitBlocker, type TaskPhase } from "@/lib/video-task";
import type { VideoStatus } from "@/lib/xai";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "视频生成 — Grok Studio" },
      { name: "description", content: "通过 xAI Grok Imagine 生成、编辑、延长高质量短视频。" },
    ],
  }),
  component: VideoPage,
});

const PROMPT_MAX = 2000;

function VideoPage() {
  const v = useAppStore((s) => s.video);
  const set = useAppStore((s) => s.setVideo);
  const { settings, ready } = useSettings();

  // The poll's stop handle. pollVideo has always returned one and the page used to
  // drop it: there was no cancel button, and leaving the page left a GET firing
  // every 5s for the rest of the session.
  const pollRef = useRef<{ stop: () => void } | null>(null);
  // Coming back to a task that has an id but no result means the poll is not
  // running — the page was left, or reloaded. "stopped", not "failed": the render
  // may well have finished while we were away, and 继续查询 will say so.
  const [phase, setPhase] = useState<TaskPhase>(() =>
    v.videoUrl ? "done" : v.requestId ? "stopped" : "idle",
  );

  const stopPoll = () => {
    pollRef.current?.stop();
    pollRef.current = null;
  };

  useEffect(() => stopPoll, []);

  const blocker = submitBlocker(v);
  const busy = phase === "submitting" || phase === "polling";

  /**
   * Follows a task to its verdict.
   *
   * Split out from submit so 继续查询 can re-attach to a request_id whose first
   * poll died. Re-submitting instead would render — and bill — the same prompt a
   * second time.
   */
  const track = async (requestId: string, usedDuration: number) => {
    stopPoll();
    setPhase("polling");
    set({ pollError: null });
    const handle = pollVideo(requestId, (s: VideoStatus) => set({ status: s }));
    pollRef.current = handle;
    try {
      const final = await handle.promise;
      if (final.status === "done" && final.video?.url) {
        set({ videoUrl: final.video.url, loading: false });
        setPhase("done");
        toast.success("视频生成完成");
        addGalleryFromUrl(final.video.url, {
          prompt: v.prompt,
          model: v.model,
          sceneName: SUB_MODE_LABEL[v.subMode],
          type: "video",
          duration: final.video.duration ?? usedDuration,
          provider: "xAI/NewAPI",
        })
          .then(() => toast.success("已保存到画廊"))
          .catch((e) => toast.error(`画廊保存失败：${(e as Error).message}（可手动下载）`));
      } else {
        set({ loading: false });
        setPhase("failed");
        toast.error(`任务${final.status === "failed" ? "失败" : "已过期"}`);
      }
    } catch (e) {
      // The render is still running server-side and already billing, so this is
      // reported as a lost connection to a live task, not as a failed task. The
      // request_id stays on screen and 继续查询 re-attaches.
      set({ loading: false, pollError: (e as Error).message });
      setPhase("stopped");
      toast.error("轮询中断，可用 request_id 继续查询");
    } finally {
      pollRef.current = null;
    }
  };

  const handleSubmit = async () => {
    if (blocker) return toast.error(blocker);

    stopPoll();
    setPhase("submitting");
    set({
      loading: true,
      status: null,
      videoUrl: null,
      requestId: null,
      pollError: null,
      startedAt: Date.now(),
    });
    try {
      const videoSrc = v.sourceVideoDataUri || v.sourceVideoUrl.trim();
      let request_id: string;
      let usedDuration = v.duration;
      if (v.subMode === "t2v") {
        ({ request_id } = await generateVideo({
          prompt: v.prompt,
          duration: v.duration,
          aspect_ratio: v.aspect,
          resolution: v.resolution,
          model: v.model,
        }));
      } else if (v.subMode === "i2v") {
        ({ request_id } = await generateVideo({
          prompt: v.prompt,
          duration: v.duration,
          aspect_ratio: v.aspect,
          resolution: v.resolution,
          model: v.model,
          image: v.startImage[0],
          reference_images: v.refImages.length ? v.refImages : undefined,
        }));
      } else if (v.subMode === "edit") {
        ({ request_id } = await editVideo({ prompt: v.prompt, video: videoSrc, model: v.model }));
      } else {
        usedDuration = v.extendDuration;
        ({ request_id } = await extendVideo({
          prompt: v.prompt,
          video: videoSrc,
          duration: v.extendDuration,
          model: v.model,
        }));
      }

      // Into the store before the first poll, not into a toast: from here on the
      // task is billable and this id is the only handle to it.
      set({ requestId: request_id });
      await track(request_id, usedDuration);
    } catch (e) {
      set({ loading: false });
      setPhase("failed");
      toast.error((e as Error).message);
    }
  };

  const handleCancel = () => {
    stopPoll();
    set({ loading: false });
    // Back to idle only if nothing was ever submitted; otherwise the card has to
    // stay up, because the request_id on it is the only handle to a billed render.
    setPhase(v.requestId ? "stopped" : "idle");
    toast.info("已停止查询。服务端可能仍在生成，可用 request_id 继续查询。");
  };

  const handleResume = () => {
    if (!v.requestId) return;
    set({ loading: true });
    void track(v.requestId, activeDuration(v));
  };

  const onSourceFile = async (file: File) => {
    try {
      const uri = await fileToDataUri(file);
      set({ sourceVideoDataUri: uri, sourceVideoName: file.name });
    } catch {
      // FileReader can fail on a file that vanished between pick and read.
      toast.error("读取视频失败，请重新选择文件");
    }
  };

  const needsSource = v.subMode === "edit" || v.subMode === "extend";
  const overPrompt = v.prompt.length > PROMPT_MAX * 0.9;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader
        title="视频生成"
        description="生成 / 编辑 / 延长短视频 · 仅 xAI 渠道"
        icon={Film}
      />
      <ApiKeyBanner />
      <ProviderUnsupportedBanner feature="video" />

      <div className="mb-4">
        <SubModeTabs value={v.subMode} onChange={(next: VideoSubMode) => set({ subMode: next })} />
      </div>

      {/* items-start: with 视频编辑 selected the rail collapses to one paragraph,
          and a stretched grid left most of a full-height card empty beside it. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="video-prompt">
                  {v.subMode === "extend"
                    ? "接下来的内容"
                    : v.subMode === "edit"
                      ? "修改说明"
                      : "文本提示词"}
                </Label>
                {v.prompt.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set({ prompt: "" })}
                    className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    清空
                  </Button>
                )}
              </div>
              <div className="relative">
                <Textarea
                  id="video-prompt"
                  value={v.prompt}
                  onChange={(e) => set({ prompt: e.target.value })}
                  maxLength={PROMPT_MAX}
                  placeholder={
                    v.subMode === "extend"
                      ? "描述视频接下来发生的内容，例如：镜头慢慢推近，主角抬头微笑"
                      : v.subMode === "edit"
                        ? "描述要对视频进行的修改，例如：把白天改成黄昏，加暖色调"
                        : "例如：一只机械蝴蝶在霓虹花园中起飞，慢动作，电影感运镜"
                  }
                  // pb leaves room for the counter, which sits inside the box so
                  // it cannot be mistaken for a hint about the button below it.
                  className="min-h-[140px] resize-none bg-background/60 pb-8"
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-2.5 right-3 font-mono text-xs ${
                    overPrompt ? "text-warning" : "text-muted-foreground"
                  }`}
                >
                  {v.prompt.length} / {PROMPT_MAX}
                </span>
              </div>
            </div>

            {v.subMode === "i2v" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>起始帧（必需）</Label>
                  <ImageUpload
                    values={v.startImage}
                    onChange={(next) => set({ startImage: next })}
                    max={1}
                    label="上传起始图"
                  />
                </div>
                <div className="space-y-2">
                  <Label>参考图（最多 7 张，可选）</Label>
                  <ImageUpload
                    values={v.refImages}
                    onChange={(next) => set({ refImages: next })}
                    max={7}
                    label="上传参考图"
                  />
                </div>
              </div>
            )}

            {needsSource && (
              <SourceVideoInput
                url={v.sourceVideoUrl}
                dataUri={v.sourceVideoDataUri}
                name={v.sourceVideoName}
                onFile={onSourceFile}
                onUrlChange={(next) => set({ sourceVideoUrl: next })}
                onClear={() => set({ sourceVideoDataUri: "", sourceVideoName: "" })}
              />
            )}

            <div className="space-y-2">
              <Button
                onClick={handleSubmit}
                disabled={busy || Boolean(blocker)}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                )}
                {busy ? "生成中…" : `提交生成任务 · ${SUB_MODE_LABEL[v.subMode]}`}
              </Button>
              {/* The reason sits under the disabled button rather than waiting to
                  be revealed by a click that could never have worked. */}
              {blocker && !busy && (
                <p className="text-center text-xs text-muted-foreground">{blocker}</p>
              )}
            </div>
          </div>

          <TaskProgress
            phase={phase}
            status={v.status}
            requestId={v.requestId}
            startedAt={v.startedAt}
            pollError={v.pollError}
            onCancel={handleCancel}
            onResume={handleResume}
          />

          <VideoResult videoUrl={v.videoUrl} subMode={v.subMode} busy={busy} />
        </div>

        <VideoParams
          subMode={v.subMode}
          duration={v.duration}
          extendDuration={v.extendDuration}
          aspect={v.aspect}
          resolution={v.resolution}
          model={v.model}
          provider={settings.provider}
          ready={ready}
          onChange={(patch) => set(patch)}
        />
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        视频内容由 AI 生成，请遵守相关法律法规，禁止用于违法用途。
      </p>
    </div>
  );
}
