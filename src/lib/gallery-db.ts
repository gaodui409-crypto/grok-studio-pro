// IndexedDB persistent gallery for generated images.
// Stores blob + metadata, since xAI URLs expire.

import { fetchBlobChecked } from "./http";

export type GalleryItem = {
  id: string;
  blob: Blob;
  mimeType: string;
  prompt: string;
  sceneName?: string;
  outfit?: string;
  action?: string;
  character?: string;
  model?: string;
  type?: "image" | "video";
  duration?: number;
  provider?: string;
  createdAt: number;
  size: number;
};

export type GalleryMeta = Omit<GalleryItem, "blob">;

const DB_NAME = "grok-studio-gallery";
const STORE = "images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("sceneName", "sceneName");
        store.createIndex("character", "character");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  window.dispatchEvent(new CustomEvent("grok-gallery-changed"));
}

export async function addGalleryFromUrl(
  url: string,
  meta: Omit<GalleryItem, "id" | "blob" | "mimeType" | "createdAt" | "size">,
): Promise<GalleryItem> {
  const blob = await fetchBlobChecked(url);
  const mimeType = blob.type || (meta.type === "video" ? "video/mp4" : "image/png");
  const inferredType: "image" | "video" =
    meta.type ?? (mimeType.startsWith("video/") ? "video" : "image");
  const item: GalleryItem = {
    id: uid(),
    blob,
    mimeType,
    createdAt: Date.now(),
    size: blob.size,
    ...meta,
    type: inferredType,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
  return item;
}

export async function listGallery(): Promise<GalleryMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as GalleryItem[]).map((it) => {
        // strip blob from metadata listing to keep memory low
        const { blob: _b, ...rest } = it;
        void _b;
        return rest;
      });
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as GalleryItem) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGalleryItems(ids: string[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

export async function clearGallery() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export function objectUrlFor(item: GalleryItem): string {
  return URL.createObjectURL(item.blob);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
