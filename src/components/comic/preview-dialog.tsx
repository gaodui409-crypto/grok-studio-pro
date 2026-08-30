import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { saveBlob } from "@/lib/download";
import { fetchBlobChecked } from "@/lib/http";
import { resultFileName } from "@/lib/comic-batch";
import type { ComicPageItem } from "@/lib/app-store";

/**
 * Side-by-side 原图 / 结果, with the recognised text underneath when there is any.
 *
 * The previous dialog held nothing but a read-only <Textarea> of the translation,
 * so on the colorize tab — which never produces text — "查看大图" opened a box that
 * said 该页未生成译文. The image was the one thing it could not show.
 */
export function PreviewDialog({
  page,
  onClose,
  suffix,
}: {
  page: ComicPageItem | null;
  onClose: () => void;
  /** File-name tag for the single-page download: "colored" / "translated". */
  suffix: string;
}) {
  const [side, setSide] = useState<"result" | "original">("result");
  const hasResult = !!page?.resultUrl;
  const showing = side === "result" && hasResult ? page?.resultUrl : page?.src;

  const download = async () => {
    if (!page?.resultUrl) return;
    try {
      const blob = await fetchBlobChecked(page.resultUrl);
      saveBlob(blob, resultFileName(page.name, suffix));
    } catch (e) {
      toast.error(`下载失败：${(e as Error).message}`);
    }
  };

  return (
    <Dialog
      open={!!page}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSide("result");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/60 bg-background">
        <DialogTitle className="truncate">{page?.name ?? "预览"}</DialogTitle>
        <DialogDescription className="sr-only">
          查看该页的原图与生成结果，并可下载或复制识别出的文字。
        </DialogDescription>

        {hasResult && (
          <div
            className="flex gap-1 rounded-lg border border-border/60 bg-surface/60 p-1"
            role="group"
            aria-label="切换显示原图或结果"
          >
            {(
              [
                ["result", "结果"],
                ["original", "原图"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={side === key}
                onClick={() => setSide(key)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  side === key
                    ? "bg-primary/15 text-primary-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showing && (
          <img
            src={showing}
            alt={side === "result" && hasResult ? `${page?.name} 的生成结果` : `${page?.name} 原图`}
            className="max-h-[58vh] w-full rounded-lg border border-border/50 bg-surface/40 object-contain"
          />
        )}

        {page?.translation && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              识别原文 / 译文对照
            </p>
            <Textarea
              readOnly
              value={page.translation}
              aria-label="识别原文与译文对照"
              className="min-h-[160px] font-mono text-xs"
            />
          </div>
        )}

        {page?.error && <p className="text-sm text-destructive">失败原因：{page.error}</p>}

        {hasResult && (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={download}>
              <Download className="mr-2 h-4 w-4" aria-hidden /> 下载这一页
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
