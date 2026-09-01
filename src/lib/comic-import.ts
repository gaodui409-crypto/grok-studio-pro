// Reading comic pages out of a .zip / .cbz archive, or a picked folder.
//
// The uploader only accepted a multi-select of loose image files, so a 200-page
// volume meant a 200-file selection — and CBZ, which is the format comic pages
// actually arrive in, could not be opened at all. This does the unpacking in the
// browser: jszip is already a dependency (the gallery's "download all" builds
// zips with it), and nothing leaves the machine.
//
// Sorting is the part worth getting right. Archive entry order is whatever the
// packer wrote and is frequently not reading order, so entries are sorted by
// name with numeric collation — "page-2" before "page-10", which a plain string
// sort gets backwards.

import JSZip from "jszip";

/** Extensions browsers can decode, lowercase, with the dot. */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"];

/** Archive containers this can open. */
export const ARCHIVE_EXTENSIONS = [".zip", ".cbz"];

export function isArchiveName(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isImageName(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Entries a comic archive should contribute pages from.
 *
 * Excludes directories, macOS resource forks (`__MACOSX/`, `._name` — present in
 * most zips made on a Mac and decoding to garbage), and dotfiles. Without the
 * resource-fork filter a 20-page CBZ imports as 40 pages, half of them broken.
 */
export function isPageEntry(path: string, isDir: boolean): boolean {
  if (isDir) return false;
  if (path.startsWith("__MACOSX/") || path.includes("/__MACOSX/")) return false;
  const base = path.split("/").pop() ?? path;
  if (base.startsWith(".") || base.startsWith("._")) return false;
  return isImageName(base);
}

/**
 * Reading order for archive entries.
 *
 * Numeric collation, so `page-2` precedes `page-10`. Compared on the full path
 * rather than the basename: a volume split into `ch01/` and `ch02/` subfolders
 * keeps its chapters in order, whereas comparing basenames alone would interleave
 * `ch02/001.jpg` with `ch01/001.jpg`.
 */
export function compareEntryPaths(a: string, b: string): number {
  return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

export type ImportedPage = { name: string; blob: Blob };

/**
 * What jszip will accept as an archive.
 *
 * A browser hands us a `File` (which is a Blob); the wider type is what makes
 * this module testable outside a browser, since Node's Blob is not the one
 * jszip's Blob branch expects. Every accepted type takes the same code path
 * inside jszip, so nothing about the browser behaviour changes.
 */
export type ArchiveSource = Blob | ArrayBuffer | Uint8Array;

/** MIME type for an image filename, since jszip does not preserve one. */
function mimeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

/**
 * Pages from one archive, in reading order, at most `limit` of them.
 *
 * `limit` is applied before any entry is decompressed, not after: an unbounded
 * read of a 500MB volume would inflate every page into memory just to throw most
 * of them away, and on a phone that is the difference between a warning and a
 * dead tab.
 */
export async function readArchivePages(
  file: ArchiveSource,
  limit: number,
): Promise<ImportedPage[]> {
  const zip = await JSZip.loadAsync(file);

  const paths: string[] = [];
  zip.forEach((path, entry) => {
    if (isPageEntry(path, entry.dir)) paths.push(path);
  });
  paths.sort(compareEntryPaths);

  const pages: ImportedPage[] = [];
  for (const path of paths.slice(0, Math.max(0, limit))) {
    const entry = zip.file(path);
    if (!entry) continue;
    const blob = await entry.async("blob");
    // Flatten the path: a filmstrip thumbnail has room for a filename, not for
    // `volume-3/chapter-02/scan/001.jpg`. Order is already fixed by the sort above.
    const name = path.split("/").pop() ?? path;
    pages.push({ name, blob: new Blob([blob], { type: mimeFor(name) }) });
  }
  return pages;
}

/**
 * Total pages an archive holds, without decompressing any of them.
 *
 * Lets the caller say "42 pages found, first 200 imported" rather than silently
 * truncating — the case where a user drops a full volume and needs to know that
 * what they see is a prefix.
 */
export async function countArchivePages(file: ArchiveSource): Promise<number> {
  const zip = await JSZip.loadAsync(file);
  let count = 0;
  zip.forEach((path, entry) => {
    if (isPageEntry(path, entry.dir)) count += 1;
  });
  return count;
}

/**
 * Sorts a picked folder's files the same way as archive entries.
 *
 * A directory picked with `webkitdirectory` arrives as a flat FileList whose
 * order is unspecified, and each File carries a relative path — so subfolders
 * must sort by that path, exactly as inside an archive.
 */
export function sortPickedFiles(files: File[]): File[] {
  return [...files].sort((a, b) => compareEntryPaths(relativePathOf(a), relativePathOf(b)));
}

/** `webkitRelativePath` when a folder was picked, else the bare name. */
export function relativePathOf(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return withPath.webkitRelativePath || file.name;
}
