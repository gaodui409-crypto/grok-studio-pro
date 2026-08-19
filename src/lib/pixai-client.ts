import { assertResponseOk, type FetchLike } from "./http.ts";
import { abortableSleep } from "./modelscope-polling.ts";
import type { GeneratedImage } from "./providers/types.ts";

export const PIXAI_CREATE_URL = "https://api.pixai.art/v2/image/create";
export const PIXAI_TASK_URL_PREFIX = "https://api.pixai.art/v1/task/";

export type PixAiGenerationInput = {
  apiKey: string;
  prompt: string;
  modelVersionId: string;
  aspectRatio: string;
  size: "1k" | "1.5k";
  n?: number;
  signal?: AbortSignal;
};

export type PixAiClientDependencies = {
  fetch?: FetchLike;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function nestedData(value: unknown): JsonObject {
  const object = asObject(value);
  return asObject(object?.data) ?? object ?? {};
}

function findString(value: unknown, keys: readonly string[]): string | null {
  const object = asObject(value);
  if (!object) return null;
  for (const key of keys) {
    if (typeof object[key] === "string" && object[key]) return object[key] as string;
  }
  const data = asObject(object.data);
  if (data) {
    for (const key of keys) {
      if (typeof data[key] === "string" && data[key]) return data[key] as string;
    }
  }
  return null;
}

function mimeTypeFromUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function extractMediaUrls(value: unknown): string[] {
  const root = nestedData(value);
  const outputs = asObject(root.outputs) ?? asObject(asObject(root.result)?.outputs);
  const mediaUrls = outputs?.mediaUrls;
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls
    .map((item) => {
      if (typeof item === "string") return item;
      const object = asObject(item);
      return typeof object?.url === "string" ? object.url : null;
    })
    .filter((url): url is string => Boolean(url));
}

async function readJson<T>(responsePromise: Promise<Response>, prefix: string): Promise<T> {
  const response = await responsePromise;
  await assertResponseOk(response, prefix);
  return response.json() as Promise<T>;
}

function taskIdFromResponse(value: unknown): string | null {
  return findString(value, ["taskId", "id"]);
}

function statusFromResponse(value: unknown): string | null {
  return findString(value, ["status", "state"])?.toLowerCase() ?? null;
}

const PENDING_STATUSES = new Set([
  "waiting",
  "pending",
  "started",
  "processing",
  "running",
  "queued",
]);
const SUCCESS_STATUSES = new Set(["completed", "success", "succeeded", "done"]);
const FAILED_STATUSES = new Set(["failed", "error", "cancelled", "canceled"]);

export async function runPixAiGeneration(
  input: PixAiGenerationInput,
  dependencies: PixAiClientDependencies = {},
): Promise<GeneratedImage[]> {
  const {
    fetch: fetchImpl = fetch,
    sleep = abortableSleep,
    now = Date.now,
    pollIntervalMs = 3000,
    timeoutMs = 10 * 60 * 1000,
  } = dependencies;

  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("PixAI API Key 未配置");
  const count = Math.max(1, Math.floor(input.n ?? 1));
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const images: GeneratedImage[] = [];

  for (let index = 0; index < count; index += 1) {
    input.signal?.throwIfAborted();
    const taskController = new AbortController();
    const forwardAbort = () => taskController.abort(input.signal?.reason);
    input.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeoutHandle = globalThis.setTimeout(() => taskController.abort(), timeoutMs);

    try {
      taskController.signal.throwIfAborted();
      const creation = await readJson<unknown>(
        fetchImpl(PIXAI_CREATE_URL, {
          method: "POST",
          signal: taskController.signal,
          headers,
          body: JSON.stringify({
            modelVersionId: input.modelVersionId,
            prompt: input.prompt,
            aspectRatio: input.aspectRatio,
            size: input.size,
          }),
        }),
        "PixAI 创建任务",
      );
      const taskId = taskIdFromResponse(creation);
      if (!taskId) throw new Error("PixAI 未返回任务 ID");

      const startedAt = now();
      while (true) {
        taskController.signal.throwIfAborted();
        if (now() - startedAt >= timeoutMs) throw new Error("PixAI 任务轮询超时");
        const task = await readJson<unknown>(
          fetchImpl(`${PIXAI_TASK_URL_PREFIX}${encodeURIComponent(taskId)}`, {
            method: "GET",
            signal: taskController.signal,
            headers: { Authorization: headers.Authorization },
          }),
          "PixAI 任务轮询",
        );
        const status = statusFromResponse(task);
        if (status && FAILED_STATUSES.has(status)) throw new Error("PixAI 任务失败");
        if (status && SUCCESS_STATUSES.has(status)) {
          const urls = extractMediaUrls(task);
          if (urls.length === 0) throw new Error("PixAI 未返回生成图片");
          images.push(...urls.map((url) => ({ url, mime_type: mimeTypeFromUrl(url) })));
          break;
        }
        if (!status || !PENDING_STATUSES.has(status)) {
          throw new Error(`PixAI 返回未知任务状态：${status ?? "空"}`);
        }
        await sleep(pollIntervalMs, taskController.signal);
      }
    } catch (error) {
      input.signal?.throwIfAborted();
      if (taskController.signal.aborted) throw new Error("PixAI 任务轮询超时");
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutHandle);
      input.signal?.removeEventListener("abort", forwardAbort);
    }
  }

  return images;
}
