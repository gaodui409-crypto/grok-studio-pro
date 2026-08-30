import JSZip from "jszip";
import { fetchBlobChecked } from "./http";

// Replaces file-saver. That package is CommonJS, and `import { saveAs }` from it
// throws during SSR ("Named export 'saveAs' not found"), which silently knocked
// /, /edit and /comic down to client-only rendering — the module graph reached it
// through image-gallery.tsx. Every current browser handles this natively; the only
// thing given up is file-saver's fallbacks for browsers this app never supported.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadOne(url: string, filename: string) {
  try {
    const blob = await fetchBlobChecked(url);
    saveBlob(blob, filename);
  } catch {
    // Fallback: open in new tab
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export type DownloadBatchResult = { saved: number; failed: number };

export async function downloadAllAsZip(
  items: { url: string; filename: string }[],
  zipName = "grok-studio.zip",
  /**
   * Entries already in memory — e.g. the comic translation `.txt` beside each page.
   * They cannot fail, so they are not counted in `saved`/`failed`, which report on
   * fetches only.
   */
  textFiles: { filename: string; content: string }[] = [],
): Promise<DownloadBatchResult> {
  const zip = new JSZip();
  let saved = 0;
  let failed = 0;
  await Promise.all(
    items.map(async (item) => {
      try {
        zip.file(item.filename, await fetchBlobChecked(item.url));
        saved++;
      } catch {
        failed++;
      }
    }),
  );
  for (const f of textFiles) zip.file(f.filename, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, zipName);
  return { saved, failed };
}
