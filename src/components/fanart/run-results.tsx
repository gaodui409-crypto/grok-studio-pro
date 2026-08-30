import { AlertTriangle } from "lucide-react";
import { ImageGallery } from "@/components/image-gallery";
import type { FanartRunItem } from "@/lib/app-store";

/**
 * The images a run actually produced, on the page that produced them.
 *
 * Before this, a batch reported "已保存到画廊 20 张" and showed nothing: to see
 * what you had just paid for you had to leave for /gallery, where the new images
 * were mixed in with every previous run. Failures are listed separately, with the
 * message, because a failed item is the one you most need to read.
 */
export function RunResults({ items, aspect }: { items: FanartRunItem[]; aspect: string }) {
  const images = items.filter((i) => i.status === "done" && i.url).map((i) => ({ url: i.url! }));
  const failed = items.filter((i) => i.status === "failed");

  if (images.length === 0 && failed.length === 0) return null;

  return (
    <section className="mt-8 space-y-4" aria-label="本次生成结果">
      {failed.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
            {failed.length} 张未生成
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {failed.map((item) => (
              <li key={item.id} className="break-words">
                <span className="text-foreground/85">{item.label}</span>
                {item.error && <span> — {item.error}</span>}
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
