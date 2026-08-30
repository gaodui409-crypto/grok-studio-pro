import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFallback,
  isReadable,
  openIndexFor,
  pageLabel,
  readerImage,
  resultCount,
  stepIndex,
} from "./comic-reader.ts";
import type { ComicPageItem } from "./app-store.ts";

const page = (over: Partial<ComicPageItem> = {}): ComicPageItem => ({
  id: "p1",
  name: "page-01.jpg",
  src: "data:image/png;base64,SRC",
  status: "done",
  ...over,
});

test("readerImage shows the result when there is one", () => {
  const p = page({ resultUrl: "https://x/out.png" });
  assert.equal(readerImage(p, "result"), "https://x/out.png");
  assert.equal(readerImage(p, "original"), p.src);
});

test("readerImage falls back to the upload so an unfinished page still has a frame", () => {
  const p = page({ status: "failed", error: "boom" });
  assert.equal(readerImage(p, "result"), p.src);
  assert.equal(isFallback(p, "result"), true);
  // "原图" is never a fallback — it is what was asked for.
  assert.equal(isFallback(p, "original"), false);
});

test("isFallback is false once the result arrives", () => {
  assert.equal(isFallback(page({ resultUrl: "https://x/out.png" }), "result"), false);
});

test("stepIndex clamps at both ends instead of wrapping", () => {
  assert.equal(stepIndex(0, -1, 5), 0, "下一页 at the start must not jump to the end");
  assert.equal(stepIndex(4, 1, 5), 4, "the last page is the end, not a loop back to 1");
  assert.equal(stepIndex(2, 1, 5), 3);
  assert.equal(stepIndex(2, -1, 5), 1);
});

test("stepIndex survives an empty batch without producing -1", () => {
  assert.equal(stepIndex(0, 1, 0), 0);
  assert.equal(stepIndex(0, -1, 0), 0);
});

test("stepIndex handles a jump longer than the batch", () => {
  assert.equal(stepIndex(1, 99, 5), 4);
  assert.equal(stepIndex(3, -99, 5), 0);
});

test("openIndexFor finds the page the row asked for", () => {
  const pages = [page({ id: "a" }), page({ id: "b" }), page({ id: "c" })];
  assert.equal(openIndexFor(pages, "b"), 1);
});

test("openIndexFor falls back to the first page when the id is gone", () => {
  // The page can be removed between clicking 查看大图 and the reader mounting; a raw
  // findIndex would hand back -1 and render an empty frame.
  const pages = [page({ id: "a" })];
  assert.equal(openIndexFor(pages, "removed"), 0);
  assert.equal(openIndexFor(pages, null), 0);
});

test("pageLabel is 1-based, because page 0 is not a thing in a book", () => {
  assert.equal(pageLabel(0, 12), "第 1 / 12 页");
  assert.equal(pageLabel(11, 12), "第 12 / 12 页");
});

test("isReadable allows flipping through uploads before any run", () => {
  // Checking the page order costs nothing and happens before the money is spent.
  assert.equal(isReadable([page({ status: "pending" })]), true);
  assert.equal(isReadable([]), false);
});

test("resultCount counts only pages with a generated image", () => {
  const pages = [
    page({ id: "a", resultUrl: "u1" }),
    page({ id: "b", status: "failed" }),
    page({ id: "c", resultUrl: "u2" }),
  ];
  assert.equal(resultCount(pages), 2);
});
