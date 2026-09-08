import type { ProviderId, Settings } from "./settings.ts";

const CREDENTIAL_FIELDS: Record<ProviderId, keyof Settings | null> = {
  xai: "apiKey",
  gitee: "giteeApiKey",
  modelscope: "modelscopeToken",
  aihorde: "aiHordeApiKey",
  pollinations: "pollinationsApiKey",
  pixai: "pixaiApiKey",
  "pixai-web": "pixaiWebToken",
  "pixai-pool": null,
};

type Entry = { limit: number; start: () => void };
type Queue = { active: Entry[]; pending: Entry[] };
const queues = new Map<string, Queue>();

function accountKey(provider: ProviderId, settings: Settings): string {
  const field = CREDENTIAL_FIELDS[provider];
  let credential = field ? String(settings[field]).trim() : "";
  if (provider === "aihorde" && !credential) credential = "0000000000";
  let endpoint = provider === "xai" ? settings.baseUrl : "";
  if (provider === "pixai-pool") endpoint = settings.pixaiPoolBaseUrl;
  try {
    endpoint = new URL(endpoint).href;
  } catch {
    // Invalid endpoints are reported by the provider when the request runs.
  }
  // Keys are private in-memory identifiers and are removed when the queue drains.
  return JSON.stringify([provider, endpoint.replace(/\/+$/, ""), credential]);
}

function drain(key: string, queue: Queue) {
  while (queue.pending.length) {
    const next = queue.pending[0];
    const limit = Math.min(next.limit, ...queue.active.map((entry) => entry.limit));
    if (queue.active.length >= limit) break;
    queue.pending.shift();
    queue.active.push(next);
    next.start();
  }
  if (!queue.active.length && !queue.pending.length) queues.delete(key);
}

export function scheduleImageRequest<T>(
  provider: ProviderId,
  settings: Settings,
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const key = accountKey(provider, settings);
    const queue = queues.get(key) ?? { active: [], pending: [] };
    queues.set(key, queue);
    const limit = Number.isFinite(settings.concurrency)
      ? Math.max(1, Math.min(10, Math.floor(settings.concurrency)))
      : 1;
    const cancel = () => {
      const index = queue.pending.indexOf(entry);
      if (index < 0) return;
      queue.pending.splice(index, 1);
      reject(signal!.reason);
      drain(key, queue);
    };
    const entry: Entry = {
      limit,
      start: () => {
        signal?.removeEventListener("abort", cancel);
        void Promise.resolve()
          .then(() => {
            signal?.throwIfAborted();
            return operation();
          })
          .then(resolve, reject)
          .finally(() => {
            queue.active.splice(queue.active.indexOf(entry), 1);
            drain(key, queue);
          });
      },
    };
    signal?.addEventListener("abort", cancel, { once: true });
    queue.pending.push(entry);
    drain(key, queue);
  });
}
