import { useState } from "react";
import type { GeneratedImage } from "@/lib/xai";
import { Download, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { downloadOne, downloadAllAsZip } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Turns a requested ratio into a CSS aspect-ratio value.
 *
 * As an inline style rather than a Tailwind class, because the ratio is only known
 * at runtime: Tailwind compiles the classes it can see in the source, so a
 * template-built `aspect-[16/9]` produces no CSS at all and the box silently
 * collapses.
 *
 * "auto" means the channel decides, so there is no ratio to honour — those fall
 * back to a square box, which with object-contain still shows the whole image.
 */
function aspectStyle(aspect?: string) {
  if (!aspect || aspect === "auto") return undefined;
  const [w, h] = aspect.split(":");
  if (!w || !h || !Number(w) || !Number(h)) return undefined;
  return { aspectRatio: `${Number(w)} / ${Number(h)}` };
}

export function ImageGallery({
  images,
  prefix = "grok",
  aspect,
}: {
  images: GeneratedImage[];
  prefix?: string;
  /**
   * The ratio these images were requested at, e.g. "16:9".
   *
   * Every image in one batch shares the request's parameters, so a single ratio
   * sizes the whole grid and the rows stay even. Without it the grid was a square
   * box with object-cover, which centre-cropped anything that was not square —
   * the same defect that made portrait covers unreadable in the archive.
   */
  aspect?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!images.length) return null;

  const box = aspectStyle(aspect);

  const filenameOf = (i: number) => `${prefix}-${Date.now()}-${i + 1}.png`;

  const downloadZip = async () => {
    const result = await downloadAllAsZip(
      images.map((image, index) => ({ url: image.url, filename: filenameOf(index) })),
      `${prefix}-${Date.now()}.zip`,
    );
    if (result.failed) {
      toast.warning(`已下载 ${result.saved} 张，${result.failed} 张获取失败`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          结果 · {images.length} 张
        </h3>
        <Button size="sm" variant="secondary" onClick={downloadZip}>
          <Download className="mr-1.5 h-4 w-4" /> 批量下载 zip
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {images.map((img, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-card transition hover:border-primary/40 hover:shadow-glow"
          >
            {/* No group-hover scale here. Growing the image 5% inside a box that
                fits it exactly pushes the edges outside the frame, which is the
                crop this change exists to remove — the hover affordance is the
                overlay below. */}
            <img
              src={img.url}
              alt={img.revised_prompt || `生成结果 ${i + 1}`}
              style={box}
              className={box ? "w-full object-contain" : "aspect-square w-full object-contain"}
              loading="lazy"
            />
            {/* focus-within keeps the overlay up while either button is focused;
                with opacity driven by hover alone, tabbing to them made them
                actionable but invisible. */}
            <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-background/95 via-background/30 to-transparent p-3 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
              <Button
                size="icon"
                variant="secondary"
                aria-label={`放大查看第 ${i + 1} 张`}
                onClick={() => setPreview(img.url)}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label={`下载第 ${i + 1} 张`}
                onClick={() => downloadOne(img.url, filenameOf(i))}
              >
                <Download className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl border-border/60 bg-background p-2">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {preview && (
            <img
              src={preview}
              alt="预览"
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
