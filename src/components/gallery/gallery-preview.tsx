import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { GalleryMeta } from "@/lib/gallery-db";
import { kindOf } from "@/lib/gallery-filter";

export function GalleryPreview({
  item,
  url,
  index,
  total,
  onNavigate,
  onClose,
}: {
  item: GalleryMeta | null;
  url?: string;
  index: number;
  total: number;
  onNavigate: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onNavigate(-1);
      else if (event.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNavigate]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-5xl border-border/60 bg-background p-2">
        <DialogTitle className="sr-only">预览</DialogTitle>
        <div className="relative">
          {url && item && kindOf(item) === "image" && (
            <img
              src={url}
              alt={item.prompt}
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
          {url && item && kindOf(item) === "video" && (
            <video src={url} controls autoPlay className="max-h-[85vh] w-full rounded-lg" />
          )}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur hover:bg-background"
                aria-label="上一张"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur hover:bg-background"
                aria-label="下一张"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 font-mono text-xs backdrop-blur">
                {index + 1} / {total}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
