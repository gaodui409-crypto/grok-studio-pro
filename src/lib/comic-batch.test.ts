import { test } from "node:test";
import assert from "node:assert/strict";
import {
  batchStats,
  pagesToRun,
  failedPages,
  shouldOfferRerunAll,
  formatDuration,
  resultFileName,
  translationFileName,
} from "./comic-batch.ts";
import type { ComicPageItem } from "./app-store.ts";

const page = (
  id: string,
  status: ComicPageItem["status"],
  extra: Partial<ComicPageItem> = {},
): ComicPageItem => ({ id, name: `${id}.jpg`, src: "data:,", status, ...extra });

test("batchStats counts each status and tracks settled pages", () => {
  const s = batchStats([
    page("a", "done"),
    page("b", "done"),
    page("c", "running"),
    page("d", "failed"),
    page("e", "pending"),
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.done, 2);
  assert.equal(s.running, 1);
  assert.equal(s.failed, 1);
  assert.equal(s.pending, 1);
  assert.equal(s.settled, 3);
  assert.equal(s.percent, 60);
});

test("batchStats reports 0% for an empty queue instead of dividing by zero", () => {
  const s = batchStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.percent, 0);
});

// A failed page is finished. If it did not count as settled, a batch ending in one
// failure would sit at 90% forever and read as still working.
test("batchStats counts a failure as settled, so the bar reaches 100%", () => {
  assert.equal(batchStats([page("a", "done"), page("b", "failed")]).percent, 100);
});

// The bug this module exists for: 开始 used to reset every page to pending and
// re-send the lot, so recovering one failure out of 20 cost 20 more requests.
test("pagesToRun never re-sends a page that already succeeded", () => {
  const pages = [
    page("a", "done", { resultUrl: "https://example.test/1.png" }),
    page("b", "failed"),
    page("c", "pending"),
  ];
  assert.deepEqual(
    pagesToRun(pages).map((p) => p.id),
    ["b", "c"],
  );
});

test("pagesToRun is empty once every page is done, so 开始 cannot silently re-bill", () => {
  assert.deepEqual(pagesToRun([page("a", "done"), page("b", "done")]), []);
});

test("pagesToRun leaves a running page alone — it is already in flight", () => {
  assert.deepEqual(
    pagesToRun([page("a", "running"), page("b", "pending")]).map((p) => p.id),
    ["b"],
  );
});

test("failedPages selects only failures, for 重试失败项", () => {
  const pages = [page("a", "done"), page("b", "failed"), page("c", "failed")];
  assert.deepEqual(
    failedPages(pages).map((p) => p.id),
    ["b", "c"],
  );
});

test("shouldOfferRerunAll is true only when every page is done", () => {
  assert.equal(shouldOfferRerunAll([page("a", "done"), page("b", "done")]), true);
  assert.equal(shouldOfferRerunAll([page("a", "done"), page("b", "failed")]), false);
  assert.equal(shouldOfferRerunAll([]), false);
});

test("formatDuration shows one decimal under a minute", () => {
  assert.equal(formatDuration(2340), "2.3s");
  assert.equal(formatDuration(59_900), "59.9s");
});

test("formatDuration never reads 0.0s for a fast response", () => {
  assert.equal(formatDuration(20), "0.1s");
  assert.equal(formatDuration(0), "0.1s");
});

test("formatDuration switches to minutes past 60s", () => {
  assert.equal(formatDuration(60_000), "1m 00s");
  assert.equal(formatDuration(64_400), "1m 04s");
  assert.equal(formatDuration(605_000), "10m 05s");
});

test("formatDuration returns empty for an unmeasured page", () => {
  assert.equal(formatDuration(undefined), "");
});

test("resultFileName replaces the source extension", () => {
  assert.equal(resultFileName("page-01.jpg", "colored"), "page-01-colored.png");
  assert.equal(resultFileName("扉页.webp", "translated"), "扉页-translated.png");
});

test("resultFileName keeps a dotless name intact", () => {
  assert.equal(resultFileName("page01", "colored"), "page01-colored.png");
});

test("resultFileName only strips the final extension", () => {
  assert.equal(resultFileName("ch.01.page.png", "colored"), "ch.01.page-colored.png");
});

test("translationFileName writes the translation beside it as txt", () => {
  assert.equal(translationFileName("page-01.jpg"), "page-01-translation.txt");
});
