import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore, type ComicPageItem } from "@/lib/app-store";
import { runWithConcurrency } from "@/lib/concurrency";
import { isAbortError } from "@/lib/http";
import { pagesToRun } from "@/lib/comic-batch";
import { useSettings } from "@/hooks/use-settings";

/**
 * Shared driver for the two comic batches (colorize / translate).
 *
 * The tabs previously carried the same ~90 lines twice: reset, abort controller,
 * per-page try/catch, `finally` counter bump, cancel-vs-error branch, unmount abort.
 * They had already drifted apart (one toast said "第 {name} 失败" with a stray 第),
 * which is what duplicated orchestration does over time.
 *
 * `process` gets one page and reports the gallery-save outcome; everything about
 * status transitions, timing and cancellation lives here.
 */

export type ProcessOutcome = {
  /** Set when the result could not be copied into the gallery — the generation still counts as done. */
  saveError?: string;
};

type Options = {
  /** Which side of the store this batch owns. */
  pagesKey: "colorPages" | "translatePages";
  runningKey: "colorRunning" | "translateRunning";
  /** Shown in toasts: "上色" / "翻译". */
  label: string;
  process: (page: ComicPageItem, ctx: { signal: AbortSignal }) => Promise<ProcessOutcome>;
};

export function useComicBatch({ pagesKey, runningKey, label, process }: Options) {
  const { settings } = useSettings();
  const pages = useAppStore((s) => s.comic[pagesKey]);
  const running = useAppStore((s) => s.comic[runningKey]);
  const patch = useAppStore((s) => s.patchComic);
  const runRef = useRef<AbortController | null>(null);

  // The batch outlives this component (progress lives in the global store), so an
  // unmount must stop the in-flight requests or they keep burning provider quota
  // with no UI left to cancel them.
  useEffect(() => () => runRef.current?.abort(), []);

  const updatePage = useCallback(
    (id: string, p: Partial<ComicPageItem>) => {
      patch((s) => ({
        ...s,
        [pagesKey]: s[pagesKey].map((x) => (x.id === id ? { ...x, ...p } : x)),
      }));
    },
    [patch, pagesKey],
  );

  // Via patch, not set: a computed key widens to `{ [x: string]: boolean }`, which
  // Partial<ComicState> rejects, and spreading the current state keeps it typed
  // without a cast.
  const setRunning = useCallback(
    (v: boolean) => {
      patch((s) => ({ ...s, [runningKey]: v }));
    },
    [patch, runningKey],
  );

  const cancel = useCallback(() => runRef.current?.abort(), []);

  /**
   * @param targets pages to send. Defaults to "everything not already done" —
   *   a successful page is never re-sent unless the caller asks for it by name.
   */
  const run = useCallback(
    async (targets?: ComicPageItem[]) => {
      const queue = targets ?? pagesToRun(pages);
      if (!queue.length) return;
      // Every caller is behind a disabled={running} button, but overwriting runRef
      // would orphan the in-flight controller: the first batch would keep spending
      // quota with nothing left able to cancel it. Too expensive to leave up to the
      // buttons staying correct.
      if (runRef.current) return;

      const controller = new AbortController();
      runRef.current = controller;
      setRunning(true);

      // Reset only the pages actually being sent. Results for pages outside the
      // queue stay on screen while the retry runs beside them.
      const queued = new Set(queue.map((p) => p.id));
      patch((s) => ({
        ...s,
        [pagesKey]: s[pagesKey].map((p) =>
          queued.has(p.id)
            ? {
                ...p,
                status: "pending" as const,
                resultUrl: undefined,
                error: undefined,
                step: undefined,
                startedAt: undefined,
                elapsedMs: undefined,
              }
            : p,
        ),
      }));

      let unsaved = 0;
      let firstSaveError = "";
      let failed = 0;
      let firstFailure = "";

      try {
        await runWithConcurrency(
          queue,
          async (page) => {
            controller.signal.throwIfAborted();
            const startedAt = Date.now();
            updatePage(page.id, { status: "running", startedAt });
            try {
              const { saveError } = await process(page, { signal: controller.signal });
              updatePage(page.id, {
                status: "done",
                step: undefined,
                elapsedMs: Date.now() - startedAt,
              });
              if (saveError) {
                unsaved++;
                if (!firstSaveError) firstSaveError = `${page.name}: ${saveError}`;
              }
            } catch (e) {
              if (isAbortError(e)) throw e;
              const message = (e as Error).message;
              failed++;
              if (!firstFailure) firstFailure = `${page.name}: ${message}`;
              // No toast per page. A 24-page batch against a rate-limited channel
              // fails 24 times, and 24 stacked toasts bury each other and every
              // other message on screen. The error lives on the row, where it can
              // be read next to the page it belongs to, and is summarised once below.
              updatePage(page.id, {
                status: "failed",
                error: message,
                step: undefined,
                elapsedMs: Date.now() - startedAt,
              });
            }
          },
          settings.concurrency,
        );
      } catch (e) {
        // Leaving a cancelled page as `running` would read as forever-in-progress.
        patch((s) => ({
          ...s,
          [pagesKey]: s[pagesKey].map((p) =>
            queued.has(p.id) && (p.status === "running" || p.status === "pending")
              ? { ...p, status: "failed" as const, error: "已取消", step: undefined }
              : p,
          ),
        }));
        if (isAbortError(e)) {
          toast.info(`已取消${label}任务`);
          return;
        }
        toast.error((e as Error).message);
        return;
      } finally {
        if (runRef.current === controller) {
          runRef.current = null;
          setRunning(false);
        }
      }

      const ok = queue.length - failed;
      if (failed && ok) {
        toast.warning(`${label}完成 ${ok} 张，${failed} 张失败：${firstFailure}`);
      } else if (failed) {
        toast.error(`${label}全部失败：${firstFailure}`);
      } else if (unsaved) {
        toast.warning(`${label}完成，但 ${unsaved} 张未保存到画廊：${firstSaveError}`);
      } else {
        toast.success(`${label}完成并已保存到画廊`);
      }
    },
    [pages, patch, setRunning, updatePage, process, settings.concurrency, pagesKey, label],
  );

  return { pages, running, run, cancel, updatePage, concurrency: settings.concurrency };
}
