import assert from "node:assert/strict";
import test from "node:test";
import {
  PIXAI_WEB_GRAPHQL_URL,
  runPixAiWebGeneration,
} from "./pixai-web-client.ts";

type RecordedRequest = { url: string; init?: RequestInit };

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const baseInput = {
  token: "web-token",
  prompt: "a red fox in a moonlit forest",
  modelId: "model-1",
  width: 1024,
  height: 1024,
};

test("creates a GraphQL task with bearer authentication and required parameters", async () => {
  const requests: RecordedRequest[] = [];
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "web-task", status: "queued", outputs: null } } }),
    jsonResponse({ data: { task: { id: "web-task", status: "completed", outputs: { mediaId: "media-1" } } } }),
    jsonResponse({ data: { media: { fileUrl: "https://cdn.example/fox.png", urls: [] } } }),
  ];

  const result = await runPixAiWebGeneration(baseInput, {
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return responses.shift()!;
    },
    sleep: async () => {},
  });

  assert.deepEqual(result, [{ url: "https://cdn.example/fox.png", mime_type: "image/png" }]);
  assert.equal(requests[0].url, PIXAI_WEB_GRAPHQL_URL);
  assert.equal(requests.every((request) => request.init?.method === "POST"), true);
  assert.equal(new Headers(requests[0].init?.headers).get("authorization"), "Bearer web-token");
  assert.equal(new Headers(requests[0].init?.headers).get("content-type"), "application/json");
  const body = JSON.parse(String(requests[0].init?.body));
  assert.match(body.query, /mutation[\s\S]*createGenerationTask/);
  assert.deepEqual(body.variables.parameters, {
    prompts: baseInput.prompt,
    negativePrompts: "",
    samplingSteps: 25,
    samplingMethod: "Euler a",
    cfgScale: 6,
    clipSkip: 1,
    priority: 1000,
    extra: {},
    controlNets: [],
    width: 1024,
    height: 1024,
    modelId: "model-1",
  });
});

test("polls pending statuses until success and fetches media by id", async () => {
  const requests: RecordedRequest[] = [];
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "pending-task" } } }),
    jsonResponse({ data: { task: { id: "pending-task", status: "waiting", outputs: null } } }),
    jsonResponse({ data: { task: { id: "pending-task", status: "processing", outputs: null } } }),
    jsonResponse({ data: { task: { id: "pending-task", status: "succeeded", outputs: { mediaId: "media-2" } } } }),
    jsonResponse({ data: { media: { fileUrl: "https://cdn.example/two.jpg", urls: [] } } }),
  ];
  const sleeps: number[] = [];

  const result = await runPixAiWebGeneration(baseInput, {
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return responses.shift()!;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  assert.deepEqual(result, [{ url: "https://cdn.example/two.jpg", mime_type: "image/jpeg" }]);
  assert.deepEqual(
    requests.map((request) => JSON.parse(String(request.init?.body)).query),
    [
      "mutation CreateGenerationTask($parameters: JSONObject!) { createGenerationTask(parameters: $parameters) { id status outputs } }",
      "query GetTask($id: ID!) { task(id: $id) { id status outputs } }",
      "query GetTask($id: ID!) { task(id: $id) { id status outputs } }",
      "query GetTask($id: ID!) { task(id: $id) { id status outputs } }",
      "query GetMedia($id: String!) { media(id: $id) { fileUrl urls { variant url } } }",
    ],
  );
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps.every((ms) => ms >= 1500));
});

test("extracts batch media IDs and prefers PUBLIC media URLs", async () => {
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "batch-task" } } }),
    jsonResponse({
      data: {
        task: {
          id: "batch-task",
          status: "done",
          outputs: { batch: [{ mediaId: "first" }, { media_id: "second" }] },
        },
      },
    }),
    jsonResponse({
      data: {
        media: {
          fileUrl: "https://cdn.example/private.png",
          urls: [
            { variant: "THUMBNAIL", url: "https://cdn.example/thumb.jpg" },
            { variant: "PUBLIC", url: "https://cdn.example/public.webp" },
          ],
        },
      },
    }),
    jsonResponse({
      data: {
        media: {
          fileUrl: "https://cdn.example/second.png",
          urls: [{ variant: "OTHER", url: "https://cdn.example/other.jpeg" }],
        },
      },
    }),
  ];
  const result = await runPixAiWebGeneration(baseInput, {
    fetch: async () => responses.shift()!,
    sleep: async () => {},
  });
  assert.deepEqual(result, [
    { url: "https://cdn.example/public.webp", mime_type: "image/webp" },
    { url: "https://cdn.example/second.png", mime_type: "image/png" },
  ]);
});

test("surfaces GraphQL errors as readable messages", async () => {
  await assert.rejects(
    runPixAiWebGeneration(baseInput, {
      fetch: async () => jsonResponse({ errors: [{ message: "model is unavailable" }] }),
    }),
    /model is unavailable/,
  );
});

test("surfaces HTTP errors using the response message", async () => {
  await assert.rejects(
    runPixAiWebGeneration(baseInput, {
      fetch: async () => jsonResponse({ message: "gateway unavailable" }, 503),
    }),
    /gateway unavailable/,
  );
});

test("reports failed task statuses", async () => {
  let calls = 0;
  await assert.rejects(
    runPixAiWebGeneration(baseInput, {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ data: { createGenerationTask: { id: "failed-task" } } })
          : jsonResponse({ data: { task: { id: "failed-task", status: "failed", outputs: null } } });
      },
      sleep: async () => {},
    }),
    /PixAI 网页任务失败/,
  );
  assert.equal(calls, 2);
});

test("rejects successful tasks without media IDs or URLs", async (t) => {
  await t.test("without media IDs", async () => {
    let calls = 0;
    await assert.rejects(
      runPixAiWebGeneration(baseInput, {
        fetch: async () => {
          calls += 1;
          return calls === 1
            ? jsonResponse({ data: { createGenerationTask: { id: "empty-task" } } })
            : jsonResponse({ data: { task: { id: "empty-task", status: "completed", outputs: {} } } });
        },
      }),
      /PixAI 网页任务未返回媒体 ID/,
    );
  });

  await t.test("without a media URL", async () => {
    let calls = 0;
    await assert.rejects(
      runPixAiWebGeneration(baseInput, {
        fetch: async () => {
          calls += 1;
          if (calls === 1) return jsonResponse({ data: { createGenerationTask: { id: "no-url-task" } } });
          if (calls === 2) {
            return jsonResponse({
              data: { task: { id: "no-url-task", status: "completed", outputs: { mediaId: "no-url" } } },
            });
          }
          return jsonResponse({ data: { media: { fileUrl: "", urls: [] } } });
        },
      }),
      /PixAI 网页媒体未返回图片 URL/,
    );
  });
});

test("runs n images as serial GraphQL tasks", async () => {
  const requests: string[] = [];
  let activeCreates = 0;
  const maxActiveCreates: number[] = [];
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "first" } } }),
    jsonResponse({ data: { task: { id: "first", status: "completed", outputs: { mediaId: "media-first" } } } }),
    jsonResponse({ data: { media: { fileUrl: "https://cdn.example/first.png", urls: [] } } }),
    jsonResponse({ data: { createGenerationTask: { id: "second" } } }),
    jsonResponse({ data: { task: { id: "second", status: "completed", outputs: { mediaId: "media-second" } } } }),
    jsonResponse({ data: { media: { fileUrl: "https://cdn.example/second.png", urls: [] } } }),
  ];

  const result = await runPixAiWebGeneration({ ...baseInput, n: 2 }, {
    fetch: async (input, init) => {
      requests.push(JSON.parse(String(init?.body)).query);
      if (JSON.parse(String(init?.body)).query.startsWith("mutation")) {
        activeCreates += 1;
        maxActiveCreates.push(activeCreates);
      } else {
        activeCreates = 0;
      }
      return responses.shift()!;
    },
    sleep: async () => {},
  });

  assert.deepEqual(result.map((image) => image.url), [
    "https://cdn.example/first.png",
    "https://cdn.example/second.png",
  ]);
  assert.deepEqual(maxActiveCreates, [1, 1]);
  assert.equal(requests.filter((query) => query.startsWith("mutation")).length, 2);
});

test("times out a pending task at its deadline", async () => {
  let now = 0;
  let calls = 0;
  await assert.rejects(
    runPixAiWebGeneration(baseInput, {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ data: { createGenerationTask: { id: "queued-task" } } })
          : jsonResponse({ data: { task: { id: "queued-task", status: "pending", outputs: null } } });
      },
      sleep: async () => {
        now += 6;
      },
      now: () => now,
      pollIntervalMs: 5,
      timeoutMs: 5,
    }),
    (error: unknown) => error instanceof Error && error.name === "TimeoutError" && /超时/.test(error.message),
  );
});

test("honors an already aborted signal before network access", async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(
    runPixAiWebGeneration({ ...baseInput, signal: controller.signal }, {
      fetch: async () => {
        called = true;
        return jsonResponse({});
      },
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(called, false);
});

test("preserves a user AbortError while a request is in flight", async () => {
  const controller = new AbortController();
  let calls = 0;
  const generation = runPixAiWebGeneration({ ...baseInput, signal: controller.signal }, {
    fetch: async (_input, init) => {
      calls += 1;
      if (calls === 1) return jsonResponse({ data: { createGenerationTask: { id: "cancelled-task" } } });
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    },
    timeoutMs: 1000,
  });
  queueMicrotask(() => controller.abort());
  await assert.rejects(
    generation,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("rejects a blank token before network access", async () => {
  let called = false;
  await assert.rejects(
    runPixAiWebGeneration({ ...baseInput, token: "  " }, {
      fetch: async () => {
        called = true;
        return jsonResponse({});
      },
    }),
    /PixAI 网页 Token 未配置/,
  );
  assert.equal(called, false);
});
