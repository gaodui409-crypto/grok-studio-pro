import { PicaClient } from "./client.ts";
import {
  chapterImageDownloads,
  type Comic,
  type DownloadTask,
  type ProgressData,
} from "./types.ts";
import { picaImageFetch } from "./relay.ts";
import { chapterDirectoryName, comicDirectoryName } from "./download-paths.ts";

export type { DownloadTask } from "./types.ts";
const STORE_NAME = "downloads";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pica-downloader", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "chapterId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = operation(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("下载记录保存中断"));
    });
  } finally {
    db.close();
  }
}
export type DownloadStorage = {
  all: () => Promise<Record<string, unknown>[]>;
  put: (record: Record<string, unknown>) => Promise<void>;
  delete: (chapterId: string) => Promise<void>;
};
const indexedDbStorage: DownloadStorage = {
  all: () => transaction("readonly", (store) => store.getAll()),
  put: async (record) => {
    await transaction("readwrite", (store) => store.put(record));
  },
  delete: async (id) => {
    await transaction("readwrite", (store) => store.delete(id));
  },
};
type DownloadDependencies = {
  storage?: DownloadStorage;
  fetchImage?: (url: string, signal: AbortSignal) => Promise<Blob>;
  saveBrowserFile?: (blob: Blob, filename: string) => void;
};
type TaskChange = DownloadTask | { removed: string };
type Listener = (change: TaskChange) => void;
const isFinished = (task: DownloadTask) =>
  ["Completed", "Failed", "Cancelled"].includes(task.state);

export class DownloadManager {
  private client: PicaClient;
  private storage: DownloadStorage;
  private fetchImage: NonNullable<DownloadDependencies["fetchImage"]>;
  private saveBrowserFile?: DownloadDependencies["saveBrowserFile"];
  private downloadDirectory: FileSystemDirectoryHandle | null = null;
  private tasks = new Map<string, DownloadTask>();
  private listeners = new Set<Listener>();
  private speedListeners = new Set<(speed: string) => void>();
  private bytesPerSec = 0;
  private speedInterval: ReturnType<typeof setInterval>;
  private writes: Promise<void> = Promise.resolve();
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;
  readonly ready: Promise<void>;

  constructor(client = new PicaClient(), dependencies: DownloadDependencies = {}) {
    this.client = client;
    this.storage = dependencies.storage ?? indexedDbStorage;
    this.fetchImage =
      dependencies.fetchImage ??
      (async (url, signal) => {
        const response = await picaImageFetch({ data: { url }, signal });
        if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`);
        return response.blob();
      });
    this.saveBrowserFile = dependencies.saveBrowserFile;
    this.speedInterval = setInterval(() => {
      for (const cb of this.speedListeners)
        cb(`${(this.bytesPerSec / 1024 / 1024).toFixed(2)}MB/s`);
      this.bytesPerSec = 0;
    }, 1000);
    this.ready = this.restoreTasks();
    void this.ready.catch(() => {});
  }
  setClient(client: PicaClient) {
    this.client = client;
  }
  setDownloadDirectory(directory: FileSystemDirectoryHandle | null) {
    this.downloadDirectory = directory;
  }
  getDownloadDirectoryName(): string | null {
    return this.downloadDirectory?.name ?? null;
  }
  onSpeedChange(cb: (speed: string) => void) {
    this.speedListeners.add(cb);
    return () => this.speedListeners.delete(cb);
  }
  onChange(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit(change: TaskChange) {
    for (const cb of this.listeners) cb(change);
  }
  private current(task: DownloadTask, controller: AbortController) {
    return (
      !this.destroyed &&
      this.tasks.get(task.chapterId) === task &&
      task.abortController === controller &&
      !controller.signal.aborted
    );
  }
  private assertCurrent(task: DownloadTask, controller: AbortController) {
    if (!this.current(task, controller)) throw new DOMException("下载已中断", "AbortError");
  }
  private toRecord(task: DownloadTask): Record<string, unknown> {
    const { abortController: _controller, ...record } = task;
    return { ...record, downloadedImageIds: [...task.downloadedImageIds] };
  }
  private write(operation: () => Promise<void>) {
    const result = this.writes.catch(() => {}).then(operation);
    this.writes = result;
    return result;
  }
  private persist(task: DownloadTask) {
    const record = this.toRecord(task);
    return this.write(async () => {
      if (this.tasks.get(task.chapterId) === task) await this.storage.put(record);
    });
  }
  async createTask(comic: Comic, chapterId: string): Promise<void> {
    await this.ready;
    if (this.destroyed) throw new Error("下载器已关闭");
    const existing = this.tasks.get(chapterId);
    if (existing && !isFinished(existing)) throw new Error("该章节已有未结束的下载任务");
    const chapterInfo = comic.chapterInfos?.find((chapter) => chapter._id === chapterId);
    if (!chapterInfo) throw new Error(`未找到章节：${chapterId}`);
    const task: DownloadTask = {
      chapterId,
      comic,
      chapterInfo,
      state: "Pending",
      downloadedImgCount: 0,
      totalImgCount: 0,
      downloadedImageIds: [],
      abortController: new AbortController(),
      startedAt: Date.now(),
      directory: this.downloadDirectory,
    };
    this.tasks.set(chapterId, task);
    try {
      await this.persist(task);
    } catch (error) {
      if (existing) this.tasks.set(chapterId, existing);
      else this.tasks.delete(chapterId);
      throw error;
    }
    this.emit(task);
    this.enqueue(task);
  }
  async retryTask(chapterId: string): Promise<void> {
    const task = this.requireTask(chapterId);
    if (!isFinished(task)) throw new Error("只有已结束的任务可以重试");
    await this.createTask(task.comic, chapterId);
  }
  async clearFinishedTasks(): Promise<void> {
    for (const task of [...this.tasks.values()]) {
      if (!isFinished(task) || this.tasks.get(task.chapterId) !== task) continue;
      this.tasks.delete(task.chapterId);
      this.emit({ removed: task.chapterId });
      try {
        await this.write(() => this.storage.delete(task.chapterId));
      } catch (error) {
        if (!this.tasks.has(task.chapterId)) {
          this.tasks.set(task.chapterId, task);
          this.emit(task);
        }
        throw error;
      }
    }
  }

  // One serial queue owns network and disk writes; resumed runs wait for old callbacks to settle.
  private enqueue(task: DownloadTask) {
    const controller = task.abortController;
    this.queue = this.queue.then(async () => {
      if (!this.current(task, controller) || task.state !== "Pending") return;
      try {
        task.state = "Downloading";
        await this.persist(task);
        this.emit(task);
        const images = await this.client.getAllChapterImages(
          task.comic._id,
          task.chapterInfo.order,
          undefined,
          controller.signal,
        );
        this.assertCurrent(task, controller);
        if (images.length === 0) throw new Error("章节没有可下载的图片");
        const imageIds = new Set(images.map((image) => image._id));
        task.downloadedImageIds = task.downloadedImageIds.filter((id) => imageIds.has(id));
        task.totalImgCount = images.length;
        task.downloadedImgCount = task.downloadedImageIds.length;
        await this.persist(task);
        this.emit(task);
        for (const item of chapterImageDownloads(images, new Set(task.downloadedImageIds))) {
          this.assertCurrent(task, controller);
          const blob = await this.fetchImage(item.url, controller.signal);
          this.assertCurrent(task, controller);
          if (!blob.size) throw new Error("上游返回了空图片");
          this.bytesPerSec += blob.size;
          await this.saveBlob(task, item.filename, blob);
          // A write already closed on disk still counts if the user paused during that write.
          if (this.tasks.get(task.chapterId) === task && !isFinished(task)) {
            task.downloadedImageIds.push(item.id);
            task.downloadedImgCount = task.downloadedImageIds.length;
            await this.persist(task);
            this.emit(task);
          }
          this.assertCurrent(task, controller);
        }
        task.state = "Completed";
        await this.persist(task);
        this.emit(task);
      } catch (error) {
        if (!this.current(task, controller)) return;
        task.state = "Failed";
        task.error = error instanceof Error ? error.message : String(error);
        await this.persist(task).catch(() => {});
        this.emit(task);
      }
    });
  }
  private async saveBlob(task: DownloadTask, filename: string, blob: Blob): Promise<void> {
    if (!task.directory) {
      if (this.saveBrowserFile) return this.saveBrowserFile(blob, filename);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      return;
    }
    const comicDir = await task.directory.getDirectoryHandle(
      comicDirectoryName(task.comic.title, task.comic._id),
      { create: true },
    );
    const chapterDir = await comicDir.getDirectoryHandle(
      chapterDirectoryName(task.chapterInfo.order, task.chapterInfo.title, task.chapterId),
      { create: true },
    );
    await this.writeFile(chapterDir, filename, blob);
    await this.writeFile(comicDir, "comic.json", JSON.stringify(task.comic, null, 2));
  }
  private async writeFile(directory: FileSystemDirectoryHandle, name: string, data: Blob | string) {
    const file = await directory.getFileHandle(name, { create: true });
    const writer = await file.createWritable();
    try {
      await writer.write(data);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
  }
  private requireTask(id: string): DownloadTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`未找到下载任务：${id}`);
    return task;
  }
  async pauseTask(chapterId: string) {
    const task = this.requireTask(chapterId);
    if (!["Pending", "Downloading"].includes(task.state)) return;
    task.state = "Paused";
    task.abortController.abort();
    await this.persist(task);
    this.emit(task);
  }
  async resumeTask(chapterId: string) {
    const task = this.requireTask(chapterId);
    if (task.state !== "Paused") return;
    if (task.directory) {
      const directory = task.directory as FileSystemDirectoryHandle & {
        requestPermission?: (options: { mode: string }) => Promise<string>;
      };
      if (
        directory.requestPermission &&
        (await directory.requestPermission({ mode: "readwrite" })) !== "granted"
      ) {
        throw new Error("需要重新授权原下载目录后才能恢复");
      }
    }
    if (this.tasks.get(chapterId) !== task || task.state !== "Paused") return;
    task.abortController = new AbortController();
    task.state = "Pending";
    task.error = undefined;
    await this.persist(task);
    this.emit(task);
    this.enqueue(task);
  }
  async cancelTask(chapterId: string) {
    const task = this.requireTask(chapterId);
    if (isFinished(task)) return;
    task.state = "Cancelled";
    task.abortController.abort();
    await this.persist(task);
    this.emit(task);
  }
  getTask(chapterId: string): DownloadTask | undefined {
    return this.tasks.get(chapterId);
  }
  getAllTasks(): DownloadTask[] {
    return [...this.tasks.values()];
  }
  private async restoreTasks() {
    for (const record of await this.storage.all()) {
      if (this.destroyed) return;
      const task = record as unknown as DownloadTask;
      if (!task.chapterId || !task.comic || !task.chapterInfo) continue;
      if (["Pending", "Downloading"].includes(task.state)) task.state = "Paused";
      task.abortController = new AbortController();
      task.downloadedImageIds = Array.isArray(task.downloadedImageIds)
        ? task.downloadedImageIds
        : [];
      if (task.state !== "Completed") task.downloadedImgCount = task.downloadedImageIds.length;
      this.tasks.set(task.chapterId, task);
      this.emit(task);
    }
  }
  getProgressData(task: DownloadTask): ProgressData {
    return {
      ...task,
      percentage: task.totalImgCount
        ? Math.round((task.downloadedImgCount / task.totalImgCount) * 100)
        : 0,
      indicator: task.state,
    };
  }
  destroy() {
    this.destroyed = true;
    clearInterval(this.speedInterval);
    for (const task of this.tasks.values()) {
      if (["Pending", "Downloading"].includes(task.state)) {
        task.state = "Paused";
        task.abortController.abort();
        void this.persist(task).catch(() => {});
      }
    }
  }
}

let instance: DownloadManager | null = null;
export function getDownloadManager(client?: PicaClient): DownloadManager {
  if (!instance) instance = new DownloadManager(client);
  else if (client) instance.setClient(client);
  return instance;
}
export function resetDownloadManager() {
  instance?.destroy();
  instance = null;
}
