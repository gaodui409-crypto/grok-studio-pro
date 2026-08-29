import { useState } from "react";
import type { GeneratedImage } from "@/lib/xai";
import { Download, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { downloadOne, downloadAllAsZip } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ImageGallery({
  images,
  prefix = "grok",
}: {
  images: GeneratedImage[];
  prefix?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!images.length) return null;

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
            <img
              src={img.url}
              alt={img.revised_prompt || `生成结果 ${i + 1}`}
              className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-background/95 via-background/30 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
              <Button size="icon" variant="secondary" onClick={() => setPreview(img.url)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => downloadOne(img.url, filenameOf(i))}
              >
                <Download className="h-4 w-4" />
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
