import { assertResponseOk, type FetchLike } from "./http.ts";
import { abortableSleep } from "./modelscope-polling.ts";
import type { GeneratedImage } from "./providers/types.ts";

export const PIXAI_WEB_GRAPHQL_URL = "https://api.pixai.art/graphql";

export type PixAiWebGenerationInput = {
  token: string;
  prompt: string;
  modelId: string;
  width: number;
  height: number;
  n?: number;
  signal?: AbortSignal;
};

export type PixAiWebClientDependencies = {
  fetch?: FetchLike;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

const CREATE_GENERATION_TASK_QUERY =
  "mutation CreateGenerationTask($parameters: JSONObject!) { createGenerationTask(parameters: $parameters) { id status outputs } }";
const TASK_QUERY =
  "query GetTask($id: ID!) { task(id: $id) { id status outputs } }";
const MEDIA_QUERY =
  "query GetMedia($id: String!) { media(id: $id) { fileUrl urls { variant url } } }";

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

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function timeoutError(): Error {
  const error = new Error("PixAI 网页任务轮询超时");
  error.name = "TimeoutError";
  return error;
}

function abortError(reason?: unknown): unknown {
  return reason ?? new DOMException("操作已取消", "AbortError");
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result || null;
}

function statusOf(value: unknown): string | null {
  return nonEmptyString(asObject(value)?.status)?.toLowerCase() ?? null;
}

function mediaIdsFromOutputs(value: unknown): string[] {
  const outputs = asObject(value);
  if (!outputs) return [];

  const ids: string[] = [];
  const directId = nonEmptyString(outputs.mediaId);
  if (directId) ids.push(directId);

  const batch = outputs.batch;
  if (Array.isArray(batch)) {
    for (const item of batch) {
      const object = asObject(item);
      const mediaId = nonEmptyString(object?.mediaId) ?? nonEmptyString(object?.media_id);
      if (mediaId) ids.push(mediaId);
    }
  }
  return ids;
}

function mimeTypeFromUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function mediaUrlFromResponse(value: unknown): string | null {
  const media = asObject(asObject(value)?.media);
  if (!media) return null;
  const urls = Array.isArray(media.urls) ? media.urls : [];
  const entries = urls
    .map((entry) => {
      const object = asObject(entry);
      const url = nonEmptyString(object?.url);
      const variant = nonEmptyString(object?.variant);
      return url ? { url, variant: variant?.toUpperCase() } : null;
    })
    .filter((entry): entry is { url: string; variant: string | undefined } => Boolean(entry));
  return (
    entries.find((entry) => entry.variant === "PUBLIC")?.url ??
    nonEmptyString(media.fileUrl) ??
    entries[0]?.url ??
    null
  );
}

function graphQlErrorMessage(value: unknown): string | null {
  const errors = asObject(value)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const messages = errors
    .map((error) => {
      const object = asObject(error);
      return nonEmptyString(object?.message) ?? (typeof error === "string" ? error.trim() : null);
    })
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join("; ") : "GraphQL 请求失败";
}

async function graphQlRequest(
  fetchImpl: FetchLike,
  query: string,
  variables: JsonObject,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<JsonObject> {
  const response = await fetchImpl(PIXAI_WEB_GRAPHQL_URL, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({ query, variables }),
  });
  await assertResponseOk(response, "PixAI 网页 GraphQL 请求");
  const payload: unknown = await response.json();
  const graphQlError = graphQlErrorMessage(payload);
  if (graphQlError) throw new Error(`PixAI 网页 GraphQL 错误: ${graphQlError}`);
  const data = asObject(asObject(payload)?.data);
  if (!data) throw new Error("PixAI 网页 GraphQL 响应缺少 data");
  return data;
}

function buildParameters(input: PixAiWebGenerationInput): JsonObject {
  return {
    prompts: input.prompt,
    negativePrompts: "",
    samplingSteps: 25,
    samplingMethod: "Euler a",
    cfgScale: 6,
    clipSkip: 1,
    priority: 1000,
    extra: {},
    controlNets: [],
    width: input.width,
    height: input.height,
    modelId: input.modelId,
  };
}

export async function runPixAiWebGeneration(
  input: PixAiWebGenerationInput,
  dependencies: PixAiWebClientDependencies = {},
): Promise<GeneratedImage[]> {
  const token = input.token.trim();
  if (!token) throw new Error("PixAI 网页 Token 未配置");

  const {
    fetch: fetchImpl = fetch,
    sleep = abortableSleep,
    now = Date.now,
    pollIntervalMs = 3000,
    timeoutMs = 10 * 60 * 1000,
  } = dependencies;
  const count = Math.max(1, Math.floor(input.n ?? 1));
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const images: GeneratedImage[] = [];

  for (let index = 0; index < count; index += 1) {
    if (input.signal?.aborted) throw abortError(input.signal.reason);

    const taskController = new AbortController();
    const startedAt = now();
    let deadlineExpired = false;
    const forwardAbort = () => taskController.abort(input.signal?.reason);
    input.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeoutHandle = globalThis.setTimeout(() => {
      deadlineExpired = true;
      taskController.abort(timeoutError());
    }, Math.max(0, timeoutMs));

    const assertActive = () => {
      if (input.signal?.aborted) throw abortError(input.signal.reason);
      if (now() - startedAt >= timeoutMs) {
        deadlineExpired = true;
        taskController.abort(timeoutError());
        throw timeoutError();
      }
    };

    try {
      assertActive();
      const creationData = await graphQlRequest(
        fetchImpl,
        CREATE_GENERATION_TASK_QUERY,
        { parameters: buildParameters(input) },
        headers,
        taskController.signal,
      );
      const creation = asObject(creationData.createGenerationTask);
      const taskId = nonEmptyString(creation?.id);
      if (!taskId) throw new Error("PixAI 网页未返回任务 ID");

      let outputs: unknown;
      while (true) {
        assertActive();
        const taskData = await graphQlRequest(
          fetchImpl,
          TASK_QUERY,
          { id: taskId },
          headers,
          taskController.signal,
        );
        const task = asObject(taskData.task);
        const status = statusOf(task);
        if (status && FAILED_STATUSES.has(status)) throw new Error("PixAI 网页任务失败");
        if (status && SUCCESS_STATUSES.has(status)) {
          outputs = task?.outputs;
          break;
        }
        if (!status || !PENDING_STATUSES.has(status)) {
          throw new Error(`PixAI 网页返回未知任务状态：${status ?? "空"}`);
        }
        await sleep(pollIntervalMs, taskController.signal);
      }

      const mediaIds = mediaIdsFromOutputs(outputs);
      if (mediaIds.length === 0) throw new Error("PixAI 网页任务未返回媒体 ID");
      for (const mediaId of mediaIds) {
        assertActive();
        const mediaData = await graphQlRequest(fetchImpl, MEDIA_QUERY, { id: mediaId }, headers, taskController.signal);
        const url = mediaUrlFromResponse(mediaData);
        if (!url) throw new Error("PixAI 网页媒体未返回图片 URL");
        images.push({ url, mime_type: mimeTypeFromUrl(url) });
      }
    } catch (error) {
      if (input.signal?.aborted) throw abortError(input.signal.reason);
      if (deadlineExpired || (taskController.signal.aborted && taskController.signal.reason?.name === "TimeoutError")) {
        throw timeoutError();
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutHandle);
      input.signal?.removeEventListener("abort", forwardAbort);
    }
  }

  return images;
}
