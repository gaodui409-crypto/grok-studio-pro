import { useEffect, useRef, useState } from "react";
import { getGalleryItem } from "@/lib/gallery-db";
import { ObjectUrlRegistry } from "@/lib/object-url-registry";

/**
 * Object URLs for exactly the ids passed in — nothing more.
 *
 * The caller passes only what is on screen. Loading the whole archive would pull
 * every blob into memory at once, which for a few hundred images is hundreds of
 * megabytes; paging keeps it bounded, and ids that scroll out get revoked.
 */
export function useObjectUrls(ids: string[]) {
  const registryRef = useRef<ObjectUrlRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = new ObjectUrlRegistry(
      (blob) => URL.createObjectURL(blob),
      (url) => URL.revokeObjectURL(url),
    );
  }
  const registry = registryRef.current;
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Depend on the joined key, not the array: the caller rebuilds the array every
  // render, and identity alone would re-run this effect forever.
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    const wanted = key ? key.split(",") : [];
    registry.reconcile(new Set(wanted));
    setUrls(registry.snapshot());

    (async () => {
      for (const id of wanted) {
        if (cancelled || registry.has(id)) continue;
        const full = await getGalleryItem(id).catch(() => null);
        if (cancelled || !full) continue;
        registry.register(id, full.blob);
        setUrls(registry.snapshot());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, registry]);

  useEffect(() => () => registry.dispose(), [registry]);

  return urls;
}
