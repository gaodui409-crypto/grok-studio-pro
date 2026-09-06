import type { ChapterInfo, Comic, DownloadTaskState, ProgressData } from "./types";
import { picaImageFetch } from "./relay";

const DB_NAME = "pica-downloader";
const DB_VERSION = 1;
const STORE_NAME = "downloads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "chapterId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(chapterId: string): Promise<Record<string, unknown> | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(chapterId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(chapterId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(chapterId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll(): Promise<Record<string, unknown>[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type DownloadTask = {
  chapterId: string;
  comic: Comic;
  chapterInfo: ChapterInfo;
  state: DownloadTaskState;
  downloadedImgCount: number;
  totalImgCount: number;
  abortController: AbortController;
  startedAt: number;
};

type Listener = (task: DownloadTask) => void;

export class DownloadManager {
  private tasks = new Map<string, DownloadTask>();
  private listeners = new Set<Listener>();
  private chapterSemaphore: { count: number; waiting: (() => void)[] } = {
    count: 3,
    waiting: [],
  };
  private imgSemaphore: { count: number; waiting: (() => void)[] } = {
    count: 20,
    waiting: [],
  };
  private bytesPerSec = 0;
  private speedInterval: ReturnType<typeof setInterval> | null = null;
  private speedListeners = new Set<(speed: string) => void>();
  private byteCounter = 0;

  constructor() {
    this.speedInterval = setInterval(() => {
      const mbps = (this.bytesPerSec / 1024 / 1024).toFixed(2);
      this.bytesPerSec = 0;
      for (const cb of this.speedListeners) {
        cb(`${mbps}MB/s`);
      }
    }, 1000);
    this.restoreTasks();
  }

  destroy() {
    if (this.speedInterval) clearInterval(this.speedInterval);
  }

  onSpeedChange(cb: (speed: string) => void) {
    this.speedListeners.add(cb);
    return () => this.speedListeners.delete(cb);
  }

  onChange(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(task: DownloadTask) {
    for (const cb of this.listeners) cb(task);
  }

  private async acquireChapter() {
    if (this.chapterSemaphore.count > 0) {
      this.chapterSemaphore.count--;
      return;
    }
    await new Promise<void>((resolve) => this.chapterSemaphore.waiting.push(resolve));
  }

  private releaseChapter() {
    this.chapterSemaphore.count++;
    const next = this.chapterSemaphore.waiting.shift();
    if (next) {
      this.chapterSemaphore.count--;
      next();
    }
  }

  private async acquireImg() {
    if (this.imgSemaphore.count > 0) {
      this.imgSemaphore.count--;
      return;
    }
    await new Promise<void>((resolve) => this.imgSemaphore.waiting.push(resolve));
  }

  private releaseImg() {
    this.imgSemaphore.count++;
    const next = this.imgSemaphore.waiting.shift();
    if (next) {
      this.imgSemaphore.count--;
      next();
    }
  }

  private toRecord(task: DownloadTask): Record<string, unknown> {
    return {
      chapterId: task.chapterId,
      comicId: task.comic._id,
      comicTitle: task.comic.title,
      comic: task.comic,
      chapterTitle: task.chapterInfo.title,
      chapterInfo: task.chapterInfo,
      state: task.state,
      downloadedImgCount: task.downloadedImgCount,
      totalImgCount: task.totalImgCount,
      startedAt: task.startedAt,
    };
  }

  async createTask(comic: Comic, chapterId: string): Promise<void> {
    const existing = this.tasks.get(chapterId);
    if (existing && ["Pending", "Downloading", "Paused"].includes(existing.state)) {
      throw new Error(`章节ID为\`${chapterId}\`的下载任务已存在`);
    }
    this.tasks.delete(chapterId);
    await dbDelete(chapterId);

    const chapterInfo = comic.chapterInfos.find((c) => c._id === chapterId);
    if (!chapterInfo) throw new Error(`未找到章节ID为\`${chapterId}\`的章节信息`);

    const task: DownloadTask = {
      chapterId,
      comic,
      chapterInfo,
      state: "Pending",
      downloadedImgCount: 0,
      totalImgCount: 0,
      abortController: new AbortController(),
      startedAt: Date.now(),
    };

    this.tasks.set(chapterId, task);
    await dbPut(this.toRecord(task));
    this.emit(task);

    this.runTask(task);
  }

  private async runTask(task: DownloadTask) {
    this.emit(task);

    let chapterPermit = false;
    while (true) {
      const state = task.state;
      if (state === "Cancelled") {
        await dbDelete(task.chapterId);
        this.tasks.delete(task.chapterId);
        this.emit(task);
        return;
      }
      if (state === "Paused") {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      if (state === "Pending" && !chapterPermit) {
        await this.acquireChapter();
        chapterPermit = true;
        if (task.state === "Pending") {
          task.state = "Downloading";
          await dbPut(this.toRecord(task));
          this.emit(task);
        }
        continue;
      }
      if (state === "Downloading" && chapterPermit) {
        await this.downloadChapter(task);
        this.releaseChapter();
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async downloadChapter(task: DownloadTask) {
    try {
      await this.fetchChapterImages(task);
      if (task.state === "Cancelled") return;

      const downloaded = task.downloadedImgCount;
      const total = task.totalImgCount;
      if (downloaded < total) {
        task.state = "Failed";
        await dbPut(this.toRecord(task));
        this.emit(task);
        return;
      }
      task.state = "Completed";
      await dbPut(this.toRecord(task));
      this.emit(task);
    } catch {
      if (task.state !== "Cancelled") {
        task.state = "Failed";
        await dbPut(this.toRecord(task));
        this.emit(task);
      }
    }
  }

  private async fetchChapterImages(task: DownloadTask) {
    const { comic, chapterInfo } = task;
    const chapterOrder = chapterInfo.order;

    task.totalImgCount = chapterInfo.images?.total ?? 0;
    task.downloadedImgCount = 0;
    await dbPut(this.toRecord(task));
    this.emit(task);

    if (task.totalImgCount === 0) return;

    const pageImages = chapterInfo.images?.docs ?? [];
    const imgUrls: { url: string; filename: string }[] = [];

    for (const img of pageImages) {
      const url = `${img.media.fileServer}/static/${img.media.path}`;
      const filename = img.media.originalName || `${img._id}.jpg`;
      imgUrls.push({ url, filename });
    }

    const joinSet: Promise<void>[] = [];
    for (const item of imgUrls) {
      const t = task;
      const ctrl = task.abortController;
      joinSet.push(this.downloadOne(t, item.url, item.filename, ctrl.signal));
    }
    await Promise.all(joinSet);
  }

  private async downloadOne(
    task: DownloadTask,
    url: string,
    filename: string,
    signal: AbortSignal,
  ) {
    await this.acquireImg();
    try {
      if (task.state === "Cancelled") return;
      // 图床无 CORS 头且可能被墙，统一经服务端中转下载。
      const resp = await picaImageFetch({ data: { url }, signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const size = blob.size;
      this.byteCounter += size;
      this.bytesPerSec += size;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

      task.downloadedImgCount++;
      await dbPut(this.toRecord(task));
      this.emit(task);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.error(`Download failed: ${filename}`, e);
    } finally {
      this.releaseImg();
    }
  }

  pauseTask(chapterId: string) {
    const task = this.tasks.get(chapterId);
    if (!task) throw new Error(`未找到章节ID为\`${chapterId}\`的下载任务`);
    task.state = "Paused";
    task.abortController.abort();
    dbPut(this.toRecord(task));
    this.emit(task);
  }

  resumeTask(chapterId: string) {
    const task = this.tasks.get(chapterId);
    if (!task) throw new Error(`未找到章节ID为\`${chapterId}\`的下载任务`);
    task.state = "Pending";
    task.abortController = new AbortController();
    dbPut(this.toRecord(task));
    this.emit(task);
    this.runTask(task);
  }

  cancelTask(chapterId: string) {
    const task = this.tasks.get(chapterId);
    if (!task) throw new Error(`未找到章节ID为\`${chapterId}\`的下载任务`);
    task.state = "Cancelled";
    task.abortController.abort();
    this.emit(task);
  }

  getTask(chapterId: string): DownloadTask | undefined {
    return this.tasks.get(chapterId);
  }

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  private async restoreTasks() {
    const records = await dbAll();
    for (const rec of records) {
      const state = rec.state as DownloadTaskState;
      if (state === "Downloading" || state === "Pending") {
        rec.state = "Paused" as DownloadTaskState;
      }
      const task = rec as unknown as DownloadTask;
      if (!task.abortController) {
        task.abortController = new AbortController();
      }
      this.tasks.set(task.chapterId, task);
      this.emit(task);
    }
  }

  getProgressData(task: DownloadTask): ProgressData {
    const percentage =
      task.totalImgCount > 0 ? Math.round((task.downloadedImgCount / task.totalImgCount) * 100) : 0;
    const indicator =
      task.state === "Downloading"
        ? `下载中 · ${task.downloadedImgCount}/${task.totalImgCount} 张`
        : task.state === "Paused"
          ? "已暂停"
          : task.state === "Completed"
            ? "已完成"
            : task.state === "Failed"
              ? "失败"
              : "等待中";
    return {
      ...task,
      percentage,
      indicator,
    };
  }
}

let instance: DownloadManager | null = null;

export function getDownloadManager(): DownloadManager {
  if (!instance) {
    instance = new DownloadManager();
  }
  return instance;
}

export function resetDownloadManager() {
  if (instance) {
    instance.destroy();
  }
  instance = null;
}
