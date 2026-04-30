import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function downloadOne(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
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

export async function downloadAllAsZip(
  items: { url: string; filename: string }[],
  zipName = "grok-studio.zip",
) {
  const zip = new JSZip();
  await Promise.all(
    items.map(async (it) => {
      try {
        const res = await fetch(it.url);
        const blob = await res.blob();
        zip.file(it.filename, blob);
      } catch {
        /* skip failed */
      }
    }),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
}
