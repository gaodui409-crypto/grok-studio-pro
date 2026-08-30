// Pure helpers for the comic batch queue.
//
// Extracted from the route so the arithmetic that decides what a run costs — which
// pages get sent, and therefore what the user is billed for — is testable without
// mounting React or stubbing the network.

import type { ComicPageItem } from "./app-store";

/** Colouring styles offered as chips. Six, so they all fit on one row-and-a-bit. */
export const COLOR_STYLES = [
  "日系动漫上色",
  "90 年代港漫复古色",
  "美漫浓郁上色",
  "水彩柔和上色",
  "厚涂写实上色",
  "赛璐璐平涂上色",
];

/** Languages offered in both ends of the translate picker. */
export const LANGS = ["日语", "英语", "韩语", "简体中文", "繁体中文"];

export type BatchStats = {
  total: number;
  done: number;
  running: number;
  failed: number;
  pending: number;
  /** Finished either way. What the progress bar tracks. */
  settled: number;
  percent: number;
};

export function batchStats(pages: ComicPageItem[]): BatchStats {
  const done = pages.filter((p) => p.status === "done").length;
  const running = pages.filter((p) => p.status === "running").length;
  const failed = pages.filter((p) => p.status === "failed").length;
  const pending = pages.filter((p) => p.status === "pending").length;
  const settled = done + failed;
  return {
    total: pages.length,
    done,
    running,
    failed,
    pending,
    settled,
    percent: pages.length ? Math.round((settled / pages.length) * 100) : 0,
  };
}

/**
 * Pages a plain "开始" click should send.
 *
 * Only the ones with nothing to show: never a page that already succeeded. The old
 * code reset every page to `pending` and re-sent the lot, so a batch of 20 where
 * page 19 failed cost 20 more requests to recover one page. Re-running a finished
 * page is still possible, just not the default — see `shouldOfferRerunAll`.
 */
export function pagesToRun(pages: ComicPageItem[]): ComicPageItem[] {
  return pages.filter((p) => p.status === "pending" || p.status === "failed");
}

export function failedPages(pages: ComicPageItem[]): ComicPageItem[] {
  return pages.filter((p) => p.status === "failed");
}

/** True when every page already succeeded, so "开始" would have nothing to do. */
export function shouldOfferRerunAll(pages: ComicPageItem[]): boolean {
  return pages.length > 0 && pages.every((p) => p.status === "done");
}

/** "2.3s" / "1m 04s". Sub-second rounds up to 0.1s so a row never reads "0s". */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms < 0) return "";
  if (ms < 60_000) return `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** `page-01.jpg` -> `page-01-colored.png`. */
export function resultFileName(name: string, suffix: string): string {
  return `${name.replace(/\.[^.]+$/, "")}-${suffix}.png`;
}

export function translationFileName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}-translation.txt`;
}
