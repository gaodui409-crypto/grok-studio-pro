// Pure helpers for reading a finished batch as a comic.
//
// The batch queue answers "did page 14 succeed"; it cannot answer "how does this
// read". Those are different jobs: the queue is a list of billed requests, sorted by
// what needs attention, while reading a comic means going forward one page at a time
// and never being asked to make a decision between pages.
//
// Split out from the reader component for the usual reason the rest of this repo
// does it — the index arithmetic decides which page you land on, and getting it wrong
// silently skips a page you paid for, which is the kind of bug a unit test catches
// and a screenshot does not.

import type { ComicPageItem } from "./app-store";

/** Which image a reader page is currently showing. */
export type ReadSide = "result" | "original";

/**
 * The image to paint for a page, falling back to the upload when there is no result.
 *
 * Deliberately never returns undefined for a page that exists. A reader that hid
 * unfinished pages would renumber the book mid-run — page 7 becoming page 6 because
 * an earlier page failed — and the one moment you most want to flip through the pages
 * is right after a partial run, to see what actually came back. A failed page reads as
 * the original with a note on it, which is true: that page is still black and white.
 */
export function readerImage(page: ComicPageItem, side: ReadSide): string {
  if (side === "original") return page.src;
  return page.resultUrl ?? page.src;
}

/** True when `side` fell back to the upload because the result is not there. */
export function isFallback(page: ComicPageItem, side: ReadSide): boolean {
  return side === "result" && !page.resultUrl;
}

/**
 * Clamped, not wrapped.
 *
 * Wrapping from the last page to the first is right for a carousel of unrelated
 * images and wrong for a book: it makes 下一页 at the end look like there is more to
 * read, and the reader silently restarts. Hitting the end should feel like the end,
 * which is why the buttons disable rather than cycle.
 */
export function stepIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, current + delta));
}

/**
 * Where to open the reader when it is asked for a page that is no longer there.
 *
 * Pages can be removed between opening a row's 查看大图 and the reader mounting, and
 * `-1` from a failed `findIndex` would otherwise index past the array and render a
 * blank frame instead of falling back to the start.
 */
export function openIndexFor(pages: ComicPageItem[], id: string | null): number {
  if (!id) return 0;
  const i = pages.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}

/** `第 3 / 12 页`, as one string so the header and the sr-only label cannot disagree. */
export function pageLabel(index: number, total: number): string {
  return `第 ${index + 1} / ${total} 页`;
}

/**
 * Pages worth offering a 阅读 button for.
 *
 * Any page at all, not just finished ones: flipping through the uploads to check the
 * order before spending money on a 30-page run is the same gesture as reading the
 * results afterwards, and the sort-by-filename that produced that order is a guess.
 */
export function isReadable(pages: ComicPageItem[]): boolean {
  return pages.length > 0;
}

/** How many pages in the batch have a generated result, for the reader's subtitle. */
export function resultCount(pages: ComicPageItem[]): number {
  return pages.filter((p) => p.resultUrl).length;
}
