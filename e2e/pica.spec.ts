import { test, expect, trapConsole } from "./fixtures";
import type { Comic } from "../src/lib/pica/types";

const comic = {
  _id: "comic-fixture",
  title: "Offline Comic",
  chapterCount: 1,
  chapterInfos: [{ _id: "chapter-fixture", title: "Chapter", order: 1, updatedAt: "" }],
} as Comic;

test("directory downloads survive a reload using real IndexedDB and file handles", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async (comic) => {
    const modulePath = "/src/lib/pica/download-manager.ts";
    const clientPath = "/src/lib/pica/client.ts";
    const { DownloadManager } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import("../src/lib/pica/download-manager");
    const { PicaClient } = (await import(
      /* @vite-ignore */ clientPath
    )) as typeof import("../src/lib/pica/client");
    const client = new PicaClient();
    client.getAllChapterImages = async () =>
      [1, 2].map((n) => ({
        _id: `page-${n}`,
        media: { fileServer: "https://storage1.icu", path: `${n}.png`, originalName: "same.png" },
      }));
    let release!: (blob: Blob) => void;
    let secondStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    let calls = 0;
    const manager = new DownloadManager(client, {
      fetchImage: async () => {
        if (++calls === 1) return new Blob(["page-one"], { type: "image/png" });
        secondStarted();
        return new Promise<Blob>((resolve) => {
          release = resolve;
        });
      },
    });
    const root = await navigator.storage.getDirectory();
    manager.setDownloadDirectory(await root.getDirectoryHandle("pica-fixture", { create: true }));
    await manager.createTask(comic, "chapter-fixture");
    await started;
    await manager.pauseTask("chapter-fixture");
    release(new Blob(["stale"]));
    manager.destroy();
  }, comic);

  await page.reload();
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/pica/download-manager.ts";
    const clientPath = "/src/lib/pica/client.ts";
    const { DownloadManager } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import("../src/lib/pica/download-manager");
    const { PicaClient } = (await import(
      /* @vite-ignore */ clientPath
    )) as typeof import("../src/lib/pica/client");
    const client = new PicaClient();
    client.getAllChapterImages = async () =>
      [1, 2].map((n) => ({
        _id: `page-${n}`,
        media: { fileServer: "https://storage1.icu", path: `${n}.png`, originalName: "same.png" },
      }));
    const requested: string[] = [];
    const manager = new DownloadManager(client, {
      fetchImage: async (url) => {
        requested.push(url);
        return new Blob(["page-two"], { type: "image/png" });
      },
    });
    try {
      await manager.ready;
      const restored = manager.getTask("chapter-fixture")!;
      const stateBefore = restored.state;
      const countBefore = restored.downloadedImgCount;
      const completion = new Promise<void>((resolve, reject) =>
        manager.onChange((task) => {
          if ("removed" in task) return;
          if (task.state === "Completed") resolve();
          if (task.state === "Failed") reject(new Error(task.error));
        }),
      );
      await manager.resumeTask("chapter-fixture");
      await completion;
      const directory = restored.directory!;
      const comicDir = await directory.getDirectoryHandle("Offline Comic-comic-fixture");
      const chapterDir = await comicDir.getDirectoryHandle("0001-Chapter-chapter-fixture");
      const files = await Promise.all(
        ["0001-same.png", "0002-same.png"].map(async (name) =>
          (await (await chapterDir.getFileHandle(name)).getFile()).text(),
        ),
      );
      const scanned = await client.getDownloadedComicsFromDir(directory);
      return {
        stateBefore,
        countBefore,
        requested,
        files,
        ids: scanned.map((entry) => entry._id),
        count: restored.downloadedImgCount,
      };
    } finally {
      manager.destroy();
    }
  });
  expect(result.stateBefore).toBe("Paused");
  expect(result.countBefore).toBe(1);
  expect(result.requested).toEqual(["https://storage1.icu/static/2.png"]);
  expect(result.files).toEqual(["page-one", "page-two"]);
  expect(result.ids).toEqual([comic._id]);
  expect(result.count).toBe(2);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`download queue controls and layout at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/pica");
    await expect(page.getByRole("button", { name: "登录 PicaComic", exact: true })).toBeVisible();
    const trap = trapConsole(page);
    await page.evaluate(async (comic) => {
      const storePath = "/src/lib/pica/store.ts";
      const managerPath = "/src/lib/pica/download-manager.ts";
      const clientPath = "/src/lib/pica/client.ts";
      const { usePicaStore } = (await import(
        /* @vite-ignore */ storePath
      )) as typeof import("../src/lib/pica/store");
      const { getDownloadManager } = (await import(
        /* @vite-ignore */ managerPath
      )) as typeof import("../src/lib/pica/download-manager");
      const { PicaClient } = (await import(
        /* @vite-ignore */ clientPath
      )) as typeof import("../src/lib/pica/client");
      const client = new PicaClient();
      client.setToken("offline-fixture");
      client.getFavorite = async () => ({ docs: [], total: 0, page: 1, pages: 1, limit: 20 });
      client.getRank = async () => [];
      client.getAllChapterImages = (_comicId, _order, _progress, signal) =>
        new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      const manager = getDownloadManager(client);
      await manager.createTask({ ...comic, title: "LongComicTitle".repeat(6) }, "chapter-fixture");
      await manager.pauseTask("chapter-fixture");
      usePicaStore.setState({
        client,
        isLoggedIn: true,
        token: "offline-fixture",
        currentTab: "chapter",
      });
    }, comic);
    await expect(page.getByText("已暂停", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "重新下载", exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`pica-${viewport.width}.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main *, header, [data-sonner-toast]"))
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: element.getBoundingClientRect().right,
        })),
    );
    expect(overflow).toEqual([]);
    await page.getByRole("button", { name: "清理完成", exact: true }).click();
    await expect(page.getByText(/暂无下载任务/)).toBeVisible();
    expect(trap.errors).toEqual([]);
  });
}
