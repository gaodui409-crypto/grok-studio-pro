import { useCallback, useEffect, useState } from "react";
import { listGallery, getStorageEstimate, type GalleryMeta } from "@/lib/gallery-db";

export type StorageEstimate = { usage: number; quota: number };

/**
 * The gallery's IndexedDB listing, kept in sync with the `grok-gallery-changed`
 * event other pages fire after saving.
 */
export function useGalleryItems() {
  const [items, setItems] = useState<GalleryMeta[]>([]);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listGallery();
      setItems(list);
      setStorage(await getStorageEstimate());
      setError(null);
    } catch (err) {
      // Surfaced rather than swallowed: an IndexedDB failure used to leave the
      // page showing "还没有内容", which reads as "your archive is gone".
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("grok-gallery-changed", handler);
    return () => window.removeEventListener("grok-gallery-changed", handler);
  }, [refresh]);

  return { items, storage, ready, error, refresh };
}
