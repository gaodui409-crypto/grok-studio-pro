import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { DownloadManager } from "./download-manager.ts";
import { PicaClient } from "./client.ts";
import type { ChapterImage, Comic } from "./types.ts";

const comic = {
  _id: "comic-1",
  title: "Fixture",
  chapterCount: 1,
  chapterInfos: [{ _id: "ch-1", title: "Chapter", order: 1, updatedAt: "" }],
} as Comic;
const images: ChapterImage[] = [1, 2].map((index) => ({
  _id: `page-${index}`,
  media: { fileServer: "https://storage1.icu", path: `${index}.png`, originalName: "page.png" },
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness(fetchImage: (url: string, signal: AbortSignal) => Promise<Blob>, pages = images) {
  const records = new Map<string, Record<string, unknown>>();
  const saved: string[] = [];
  const client = new PicaClient();
  client.getAllChapterImages = async () => pages;
  const manager = new DownloadManager(client, {
    storage: {
      all: async () => [...records.values()],
      put: async (record) => {
        records.set(String(record.chapterId), structuredClone(record));
      },
      delete: async (id) => {
        records.delete(id);
      },
    },
    fetchImage,
    saveBrowserFile: (_blob, name) => {
      saved.push(name);
    },
  });
  return { manager, records, saved };
}
async function state(manager: DownloadManager, expected: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (manager.getTask("ch-1")?.state === expected) return;
    await setImmediate();
  }
  assert.equal(manager.getTask("ch-1")?.state, expected);
}

test("pause remains Paused after an old image response arrives", async (t) => {
  const started = deferred<void>();
  const pending = deferred<Blob>();
  const { manager, saved } = harness(async () => {
    started.resolve();
    return pending.promise;
  });
  t.after(() => manager.destroy());
  await manager.createTask(comic, "ch-1");
  await started.promise;
  await manager.pauseTask("ch-1");
  pending.resolve(new Blob(["image"]));
  await setImmediate();
  await setImmediate();
  assert.equal(manager.getTask("ch-1")?.state, "Paused");
  assert.equal(saved.length, 0);
});

test("resume preserves saved pages and ignores the previous run", async (t) => {
  const secondStarted = deferred<void>();
  const pending = deferred<Blob>();
  let calls = 0;
  const { manager, saved } = harness(async () => {
    calls++;
    if (calls === 2) {
      secondStarted.resolve();
      return pending.promise;
    }
    return new Blob(["image"]);
  });
  t.after(() => manager.destroy());
  await manager.createTask(comic, "ch-1");
  await secondStarted.promise;
  await manager.pauseTask("ch-1");
  await manager.resumeTask("ch-1");
  pending.resolve(new Blob(["stale"]));
  await state(manager, "Completed");
  assert.equal(calls, 3);
  assert.equal(saved.length, 2);
  assert.equal(new Set(saved).size, 2);
});

test("failed tasks can retry and cleared tasks disappear from persistence", async (t) => {
  let fail = true;
  const { manager, records } = harness(async () => {
    if (fail) throw new Error("fixture failure");
    return new Blob(["image"]);
  });
  t.after(() => manager.destroy());
  await manager.createTask(comic, "ch-1");
  await state(manager, "Failed");
  const old = manager.getTask("ch-1");
  fail = false;
  await manager.retryTask("ch-1");
  await state(manager, "Completed");
  assert.notEqual(manager.getTask("ch-1"), old);
  await manager.clearFinishedTasks();
  assert.deepEqual(manager.getAllTasks(), []);
  assert.equal(records.has("ch-1"), false);
});

test("a cancelled run cannot delete or persist over its replacement", async (t) => {
  const started = deferred<void>();
  const pending = deferred<Blob>();
  let calls = 0;
  const { manager, records, saved } = harness(
    async () => {
      calls++;
      if (calls === 1) {
        started.resolve();
        return pending.promise;
      }
      return new Blob(["new"]);
    },
    images.slice(0, 1),
  );
  t.after(() => manager.destroy());
  await manager.createTask(comic, "ch-1");
  await started.promise;
  await manager.cancelTask("ch-1");
  await manager.retryTask("ch-1");
  const replacement = manager.getTask("ch-1");
  pending.resolve(new Blob(["old"]));
  await state(manager, "Completed");
  await setImmediate();
  assert.equal(manager.getTask("ch-1"), replacement);
  assert.equal(records.get("ch-1")?.state, "Completed");
  assert.equal(saved.length, 1);
});

test("duplicate creates cannot start concurrent downloads for one chapter", async (t) => {
  const { manager } = harness(async () => new Blob(["image"]));
  t.after(() => manager.destroy());
  const results = await Promise.allSettled([
    manager.createTask(comic, "ch-1"),
    manager.createTask(comic, "ch-1"),
  ]);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  await state(manager, "Completed");
});

test("an empty chapter fails instead of completing", async (t) => {
  const { manager } = harness(async () => new Blob(["image"]), []);
  t.after(() => manager.destroy());
  await manager.createTask(comic, "ch-1");
  await state(manager, "Failed");
  assert.equal(manager.getTask("ch-1")?.downloadedImgCount, 0);
});

test("clearing a snapshot of finished tasks does not remove a retried task", async (t) => {
  const deleting = deferred<void>();
  const releaseDelete = deferred<void>();
  const download = deferred<Blob>();
  const records = ["ch-1", "ch-2"].map((chapterId) => ({
    chapterId,
    comic: { ...comic, chapterInfos: [{ ...comic.chapterInfos[0], _id: chapterId }] },
    chapterInfo: { ...comic.chapterInfos[0], _id: chapterId },
    state: "Failed",
    downloadedImgCount: 0,
    totalImgCount: 0,
    downloadedImageIds: [],
    startedAt: 0,
  }));
  const client = new PicaClient();
  client.getAllChapterImages = async () => images;
  const manager = new DownloadManager(client, {
    storage: {
      all: async () => records,
      put: async () => {},
      delete: async (id) => {
        if (id === "ch-1") {
          deleting.resolve();
          await releaseDelete.promise;
        }
      },
    },
    fetchImage: async () => download.promise,
    saveBrowserFile: () => {},
  });
  t.after(() => {
    manager.destroy();
    download.resolve(new Blob(["image"]));
  });
  await manager.ready;
  const clearing = manager.clearFinishedTasks();
  await deleting.promise;
  const retrying = manager.retryTask("ch-2");
  await setImmediate();
  const replacement = manager.getTask("ch-2");
  releaseDelete.resolve();
  await Promise.all([clearing, retrying]);
  assert.equal(manager.getTask("ch-2"), replacement);
  assert.ok(manager.getTask("ch-2"));
});
