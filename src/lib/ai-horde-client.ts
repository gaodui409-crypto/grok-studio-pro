import { assertResponseOk, type FetchLike } from "./http.ts";
import { abortableSleep } from "./modelscope-polling.ts";
import type { GeneratedImage } from "./providers/types.ts";

const AI_HORDE_BASE_URL = "https://aihorde.net/api/v2";

type AiHordeGenerationInput = {
  prompt: string;
  apiKey: string;
  width: number;
  height: number;
  count: number;
  signal?: AbortSignal;
};

type AiHordeDependencies = {
  fetch?: FetchLike;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type AiHordeCheck = {
  done?: boolean;
  faulted?: boolean;
};

type AiHordeStatus = {
  generations?: Array<{ img?: string }>;
};

export function normalizeAiHordeDimension(value: number): number {
  return Math.max(64, Math.round(value / 64) * 64);
}

function mimeTypeFromUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

async function checkedJson<T>(responsePromise: Promise<Response>, prefix: string): Promise<T> {
  const response = await responsePromise;
  await assertResponseOk(response, prefix);
  return response.json() as Promise<T>;
}

export async function runAiHordeGeneration(
  input: AiHordeGenerationInput,
  dependencies: AiHordeDependencies = {},
): Promise<GeneratedImage[]> {
  const {
    fetch: fetchImpl = fetch,
    sleep = abortableSleep,
    now = Date.now,
    pollIntervalMs = 3000,
    timeoutMs = 10 * 60 * 1000,
  } = dependencies;
  input.signal?.throwIfAborted();

  const headers = {
    apikey: input.apiKey,
    "Client-Agent": "grok-studio-pro:1.0:github.com/gaodui409-crypto/grok-studio-pro",
    "Content-Type": "application/json",
  };
  const submission = await checkedJson<{ id?: string }>(
    fetchImpl(`${AI_HORDE_BASE_URL}/generate/async`, {
      method: "POST",
      signal: input.signal,
      headers,
      body: JSON.stringify({
        prompt: input.prompt,
        params: {
          n: input.count,
          width: normalizeAiHordeDimension(input.width),
          height: normalizeAiHordeDimension(input.height),
          sampler_name: "k_euler",
          steps: 20,
          cfg_scale: 7,
        },
        nsfw: false,
        censor_nsfw: true,
        trusted_workers: false,
        r2: true,
        shared: false,
      }),
    }),
    "AI Horde",
  );
  if (!submission.id) throw new Error("AI Horde 未返回任务 ID");

  const startedAt = now();
  while (true) {
    input.signal?.throwIfAborted();
    if (now() - startedAt >= timeoutMs) throw new Error("AI Horde 任务轮询超时");
    const check = await checkedJson<AiHordeCheck>(
      fetchImpl(`${AI_HORDE_BASE_URL}/generate/check/${submission.id}`, {
        signal: input.signal,
        headers: { apikey: input.apiKey, "Client-Agent": headers["Client-Agent"] },
      }),
      "AI Horde poll",
    );
    if (check.faulted) throw new Error("AI Horde 任务失败");
    if (check.done) break;
    // Sleep after checking, not before: a job that is already finished when we
    // first ask should not wait a full interval before we notice.
    await sleep(pollIntervalMs, input.signal);
  }

  const status = await checkedJson<AiHordeStatus>(
    fetchImpl(`${AI_HORDE_BASE_URL}/generate/status/${submission.id}`, {
      signal: input.signal,
      headers: { apikey: input.apiKey, "Client-Agent": headers["Client-Agent"] },
    }),
    "AI Horde result",
  );
  const images = (status.generations ?? [])
    .map((generation) => generation.img)
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, mime_type: mimeTypeFromUrl(url) }));
  if (images.length === 0) throw new Error("AI Horde 未返回生成图片");
  return images;
}
