import JSZip from "jszip";
import { saveAs } from "file-saver";
import { fetchBlobChecked } from "./http";

export async function downloadOne(url: string, filename: string) {
  try {
    const blob = await fetchBlobChecked(url);
    saveAs(blob, filename);
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
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
  return { saved, failed };
}
