import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import {
  compareEntryPaths,
  countArchivePages,
  isArchiveName,
  isImageName,
  isPageEntry,
  readArchivePages,
  relativePathOf,
  sortPickedFiles,
} from "./comic-import.ts";

// Smallest thing that is a valid PNG byte-wise; content is never decoded here.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

// Returns the raw bytes rather than a Blob: jszip's Blob branch expects the
// browser's Blob, and Node's is not it. Both go through the same code inside
// jszip, so this still exercises the real unpacking path.
async function makeArchive(paths: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const path of paths) zip.file(path, PNG_BYTES);
  return zip.generateAsync({ type: "uint8array" });
}

test("recognises the archive and image extensions, case-insensitively", () => {
  assert.equal(isArchiveName("volume.cbz"), true);
  assert.equal(isArchiveName("VOLUME.ZIP"), true);
  assert.equal(isArchiveName("volume.rar"), false);
  assert.equal(isImageName("001.JPEG"), true);
  assert.equal(isImageName("notes.txt"), false);
});

test("numeric collation puts page 2 before page 10", () => {
  // A plain string sort gets this backwards, which silently reorders the book.
  const sorted = ["page-10.jpg", "page-2.jpg", "page-1.jpg"].sort(compareEntryPaths);
  assert.deepEqual(sorted, ["page-1.jpg", "page-2.jpg", "page-10.jpg"]);
});

test("sorting compares full paths so chapters do not interleave", () => {
  const sorted = ["ch02/001.jpg", "ch01/002.jpg", "ch01/001.jpg"].sort(compareEntryPaths);
  assert.deepEqual(sorted, ["ch01/001.jpg", "ch01/002.jpg", "ch02/001.jpg"]);
});

test("skips directories, macOS resource forks and dotfiles", () => {
  // Without the resource-fork filter a 20-page CBZ imports as 40 pages, half of
  // them undecodable.
  assert.equal(isPageEntry("pages/", true), false);
  assert.equal(isPageEntry("__MACOSX/001.jpg", false), false);
  assert.equal(isPageEntry("volume/__MACOSX/001.jpg", false), false);
  assert.equal(isPageEntry("pages/._001.jpg", false), false);
  assert.equal(isPageEntry(".DS_Store", false), false);
  assert.equal(isPageEntry("pages/001.jpg", false), true);
});

test("reads archive pages in reading order", async () => {
  const archive = await makeArchive(["page-10.png", "page-2.png", "page-1.png"]);
  const pages = await readArchivePages(archive, 10);
  assert.deepEqual(
    pages.map((p) => p.name),
    ["page-1.png", "page-2.png", "page-10.png"],
  );
  assert.ok(pages.every((p) => p.blob.size > 0));
});

test("non-image entries in the archive are ignored", async () => {
  const archive = await makeArchive(["001.png", "ComicInfo.xml", "notes.txt"]);
  const pages = await readArchivePages(archive, 10);
  assert.deepEqual(
    pages.map((p) => p.name),
    ["001.png"],
  );
});

test("names are flattened to the basename", async () => {
  // A filmstrip thumbnail has room for a filename, not for a nested path.
  const archive = await makeArchive(["volume-3/chapter-02/001.png"]);
  const pages = await readArchivePages(archive, 10);
  assert.deepEqual(
    pages.map((p) => p.name),
    ["001.png"],
  );
});

test("the limit is a prefix of reading order, not an arbitrary subset", async () => {
  const archive = await makeArchive(["003.png", "001.png", "002.png"]);
  const pages = await readArchivePages(archive, 2);
  assert.deepEqual(
    pages.map((p) => p.name),
    ["001.png", "002.png"],
  );
});

test("a zero limit reads nothing rather than everything", async () => {
  const archive = await makeArchive(["001.png"]);
  assert.deepEqual(await readArchivePages(archive, 0), []);
});

test("counting does not depend on the limit", async () => {
  // Lets the UI say "42 found, first 200 imported" instead of truncating silently.
  const archive = await makeArchive(["001.png", "002.png", "003.png", "notes.txt"]);
  assert.equal(await countArchivePages(archive), 3);
});

test("picked folder files sort by relative path", () => {
  const make = (path: string) => {
    const file = new File([PNG_BYTES], path.split("/").pop() ?? path, { type: "image/png" });
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    return file;
  };
  const sorted = sortPickedFiles([
    make("v/ch2/001.png"),
    make("v/ch1/010.png"),
    make("v/ch1/002.png"),
  ]);
  assert.deepEqual(sorted.map(relativePathOf), ["v/ch1/002.png", "v/ch1/010.png", "v/ch2/001.png"]);
});

test("relativePathOf falls back to the bare name", () => {
  const file = new File([PNG_BYTES], "001.png", { type: "image/png" });
  assert.equal(relativePathOf(file), "001.png");
});
