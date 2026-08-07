export type ModelScopeTaskStatus = {
  task_status: string;
  output_images?: string[];
  errors?: unknown;
};

type PollOptions = {
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const FAILED = new Set(["FAILED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);

function abortError(): DOMException {
  return new DOMException("操作已取消", "AbortError");
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", cancelled);
      resolve();
    }
    function cancelled() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelled);
      reject(abortError());
    }
    signal?.addEventListener("abort", cancelled, { once: true });
  });
}

export async function pollModelScopeTask(
  getStatus: () => Promise<ModelScopeTaskStatus>,
  options: PollOptions = {},
): Promise<string> {
  const {
    signal,
    intervalMs = 5000,
    timeoutMs = 10 * 60 * 1000,
    now = Date.now,
    sleep = abortableSleep,
  } = options;
  const startedAt = now();

  while (true) {
    if (signal?.aborted) throw abortError();
    if (now() - startedAt >= timeoutMs) throw new Error("ModelScope 任务轮询超时");
    await sleep(intervalMs, signal);
    const status = await getStatus();
    if (status.task_status === "SUCCEED") {
      const url = status.output_images?.[0];
      if (!url) throw new Error("ModelScope 未返回 output_images");
      return url;
    }
    if (FAILED.has(status.task_status)) {
      throw new Error(`ModelScope 任务 ${status.task_status}: ${JSON.stringify(status.errors)}`);
    }
  }
}
