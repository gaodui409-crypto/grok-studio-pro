import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAiHordeDimension, runAiHordeGeneration } from "./ai-horde-client.ts";

type RecordedRequest = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("normalizes dimensions to AI Horde's 64-pixel grid", () => {
  assert.equal(normalizeAiHordeDimension(680), 704);
  assert.equal(normalizeAiHordeDimension(1024), 1024);
  assert.equal(normalizeAiHordeDimension(12), 64);
});

test("submits an anonymous generation and resolves hosted image URLs", async () => {
  const requests: RecordedRequest[] = [];
  const responses = [
    jsonResponse({ id: "task-123" }),
    jsonResponse({ done: false, faulted: false, wait_time: 8, queue_position: 4 }),
    jsonResponse({ done: true, faulted: false, wait_time: 0, queue_position: 0 }),
    jsonResponse({
      done: true,
      generations: [
        { img: "https://images.example/one.webp" },
        { img: "https://images.example/two.webp" },
      ],
    }),
  ];

  const result = await runAiHordeGeneration(
    {
      prompt: "ink wash mountain",
      apiKey: "0000000000",
      width: 1024,
      height: 576,
      count: 2,
    },
    {
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return responses.shift()!;
      },
      sleep: async () => {},
    },
  );

  assert.deepEqual(result, [
    { url: "https://images.example/one.webp", mime_type: "image/webp" },
    { url: "https://images.example/two.webp", mime_type: "image/webp" },
  ]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://aihorde.net/api/v2/generate/async",
      "https://aihorde.net/api/v2/generate/check/task-123",
      "https://aihorde.net/api/v2/generate/check/task-123",
      "https://aihorde.net/api/v2/generate/status/task-123",
    ],
  );

  const submit = requests[0].init!;
  assert.equal(submit.method, "POST");
  assert.equal(new Headers(submit.headers).get("apikey"), "0000000000");
  assert.match(new Headers(submit.headers).get("Client-Agent") ?? "", /grok-studio-pro/);
  assert.deepEqual(JSON.parse(String(submit.body)), {
    prompt: "ink wash mountain",
    params: {
      n: 2,
      width: 1024,
      height: 576,
      sampler_name: "k_euler",
      steps: 20,
      cfg_scale: 7,
    },
    nsfw: false,
    censor_nsfw: true,
    trusted_workers: false,
    r2: true,
    shared: false,
  });
});

test("reports faulted jobs without requesting final status", async () => {
  let calls = 0;
  await assert.rejects(
    runAiHordeGeneration(
      { prompt: "test", apiKey: "key", width: 512, height: 512, count: 1 },
      {
        fetch: async () => {
          calls += 1;
          return calls === 1
            ? jsonResponse({ id: "faulted-task" })
            : jsonResponse({ done: false, faulted: true });
        },
        sleep: async () => {},
      },
    ),
    /AI Horde 任务失败/,
  );
  assert.equal(calls, 2);
});

test("times out jobs that remain queued", async () => {
  let now = 0;
  let calls = 0;
  await assert.rejects(
    runAiHordeGeneration(
      { prompt: "test", apiKey: "key", width: 512, height: 512, count: 1 },
      {
        fetch: async () => {
          calls += 1;
          return calls === 1
            ? jsonResponse({ id: "queued-task" })
            : jsonResponse({ done: false, faulted: false });
        },
        sleep: async () => {
          now += 6;
        },
        now: () => now,
        timeoutMs: 5,
      },
    ),
    /AI Horde 任务轮询超时/,
  );
});

test("checks the job before sleeping so a finished job is noticed at once", async () => {
  const order: string[] = [];
  const responses = [
    jsonResponse({ id: "ready-task" }),
    jsonResponse({ done: true, faulted: false }),
    jsonResponse({ done: true, generations: [{ img: "https://images.example/ready.webp" }] }),
  ];

  const result = await runAiHordeGeneration(
    { prompt: "test", apiKey: "key", width: 512, height: 512, count: 1 },
    {
      fetch: async (input) => {
        order.push(String(input).includes("/generate/check/") ? "check" : "request");
        return responses.shift()!;
      },
      sleep: async () => {
        order.push("sleep");
      },
    },
  );

  assert.deepEqual(result, [{ url: "https://images.example/ready.webp", mime_type: "image/webp" }]);
  assert.deepEqual(
    order,
    ["request", "check", "request"],
    "a job already done on the first check must not sleep before the status fetch",
  );
});

test("honors an already aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runAiHordeGeneration({
      prompt: "test",
      apiKey: "key",
      width: 512,
      height: 512,
      count: 1,
      signal: controller.signal,
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});
