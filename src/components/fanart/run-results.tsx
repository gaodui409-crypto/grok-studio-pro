import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageGallery } from "@/components/image-gallery";
import type { FanartRunItem } from "@/lib/app-store";

/**
 * The images a run actually produced, on the page that produced them.
 *
 * Before this, a batch reported "已保存到画廊 20 张" and showed nothing: to see
 * what you had just paid for you had to leave for /gallery, where the new images
 * were mixed in with every previous run. Failures are listed separately, with the
 * message, because a failed item is the one you most need to read.
 *
 * Each failure carries its own retry, plus one for the whole set. A fanart batch
 * is dozens of images and every one of them spends quota, so re-submitting the
 * batch to recover 3 failures would re-pay for the 21 that worked — which is why
 * the comic queue got per-row retries first and why this page needed them more.
 */
export function RunResults({
  items,
  aspect,
  onRetry,
  onRetryFailed,
  running,
}: {
  items: FanartRunItem[];
  aspect: string;
  onRetry: (item: FanartRunItem) => void;
  onRetryFailed: () => void;
  /** True while any run is in flight: a second one would fight it for concurrency. */
  running?: boolean;
}) {
  const images = items.filter((i) => i.status === "done" && i.url).map((i) => ({ url: i.url! }));
  const failed = items.filter((i) => i.status === "failed");

  if (images.length === 0 && failed.length === 0) return null;

  return (
    <section className="mt-8 space-y-4" aria-label="本次生成结果">
      {failed.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              {failed.length} 张未生成
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={running}
              onClick={onRetryFailed}
              className="h-7 text-xs"
            >
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 重试全部失败项 ({failed.length})
            </Button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {failed.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words">
                  <span className="text-foreground/85">{item.label}</span>
                  {item.error && <span> — {item.error}</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={running}
                  onClick={() => onRetry(item)}
                  aria-label={`重试 ${item.label}`}
                  className="h-6 shrink-0 px-2 text-[11px]"
                >
                  <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> 重试
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* No heading of my own here: ImageGallery already renders "结果 · N 张",
          and a second count above it would be the same fact stated twice. */}
      {images.length > 0 && (
        <div className="space-y-2">
          <ImageGallery images={images} prefix="fanart" aspect={aspect} />
          <p className="text-xs text-muted-foreground">已自动保存到画廊</p>
        </div>
      )}
    </section>
  );
}
