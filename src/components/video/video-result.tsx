import { Download, ExternalLink, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadOne } from "@/lib/download";
import { videoFileName } from "@/lib/video-task";
import type { VideoSubMode } from "@/lib/app-store";

/**
 * The output area.
 *
 * Always rendered, unlike before: with nothing on screen until a URL arrived, the
 * page ended at the submit button and gave no indication that a result was going
 * to appear below rather than replace the form. The empty state names what it is
 * waiting for.
 */
export function VideoResult({
  videoUrl,
  subMode,
  busy,
}: {
  videoUrl: string | null;
  subMode: VideoSubMode;
  busy: boolean;
}) {
  if (!videoUrl) {
    return (
      <section
        aria-label="生成结果"
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-14 text-center"
      >
        <FileVideo className="h-7 w-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{busy ? "等待生成完成" : "还没有生成结果"}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {busy
            ? "生成完成后视频会出现在这里，并自动保存到画廊。"
            : "填写提示词并提交任务，生成的视频会出现在这里，并自动保存到画廊。"}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="生成结果"
      className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card"
    >
      <video src={videoUrl} controls className="w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => downloadOne(videoUrl, videoFileName(subMode))}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 下载视频
        </Button>
        {/* xAI's result URLs expire. Opening the original is the fallback when the
            gallery copy failed and the download did too. */}
        <Button type="button" variant="ghost" size="sm" asChild>
          <a href={videoUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 在新标签页打开
          </a>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        结果链接由服务端签发，可能会过期；已自动保存到画廊的副本不受影响。
      </p>
    </section>
  );
}
