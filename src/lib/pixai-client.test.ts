import assert from "node:assert/strict";
import test from "node:test";
import { runPixAiGeneration } from "./pixai-client.ts";

type RecordedRequest = { url: string; init?: RequestInit };

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const baseInput = {
  apiKey: "pixai-test-key",
  prompt: "a red fox in a moonlit forest",
  modelVersionId: "1983308862240288769",
  aspectRatio: "16:9",
  size: "1k" as const,
};

test("submits PixAI v2 image tasks with bearer authentication", async () => {
  const requests: RecordedRequest[] = [];
  const responses = [
    jsonResponse({ id: "task-123" }),
    jsonResponse({ status: "completed", outputs: { mediaUrls: ["https://cdn.example/fox.webp"] } }),
  ];

  const result = await runPixAiGeneration(baseInput, {
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return responses.shift()!;
    },
    sleep: async () => {},
  });

  assert.deepEqual(result, [{ url: "https://cdn.example/fox.webp", mime_type: "image/webp" }]);
  assert.deepEqual(
    requests.map((request) => request.url),
    ["https://api.pixai.art/v2/image/create", "https://api.pixai.art/v1/task/task-123"],
  );
  const submit = requests[0].init!;
  assert.equal(submit.method, "POST");
  assert.equal(new Headers(submit.headers).get("authorization"), "Bearer pixai-test-key");
  assert.equal(new Headers(submit.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(submit.body)), {
    modelVersionId: "1983308862240288769",
    prompt: "a red fox in a moonlit forest",
    aspectRatio: "16:9",
    size: "1k",
  });
});

test("polls pending tasks until completed and returns all media URLs", async () => {
  const requests: string[] = [];
  const responses = [
    jsonResponse({ taskId: "pending-task" }),
    jsonResponse({ status: "waiting" }),
    jsonResponse({ status: "processing" }),
    jsonResponse({
      status: "success",
      outputs: { mediaUrls: ["https://cdn.example/one.png", "https://cdn.example/two.jpg"] },
    }),
  ];
  let sleeps = 0;

  const result = await runPixAiGeneration(baseInput, {
    fetch: async (input) => {
      requests.push(String(input));
      return responses.shift()!;
    },
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.equal(sleeps, 2);
  assert.deepEqual(result, [
    { url: "https://cdn.example/one.png", mime_type: "image/png" },
    { url: "https://cdn.example/two.jpg", mime_type: "image/jpeg" },
  ]);
  assert.deepEqual(requests, [
    "https://api.pixai.art/v2/image/create",
    "https://api.pixai.art/v1/task/pending-task",
    "https://api.pixai.art/v1/task/pending-task",
    "https://api.pixai.art/v1/task/pending-task",
  ]);
});

test("runs multiple requested images as serial PixAI tasks", async () => {
  const requests: string[] = [];
  const activeCreates: number[] = [];
  let active = 0;
  const responses = [
    jsonResponse({ id: "first" }),
    jsonResponse({
      status: "completed",
      outputs: { mediaUrls: ["https://cdn.example/first.png"] },
    }),
    jsonResponse({ id: "second" }),
    jsonResponse({
      status: "completed",
      outputs: { mediaUrls: ["https://cdn.example/second.png"] },
    }),
  ];

  const result = await runPixAiGeneration(
    { ...baseInput, n: 2 },
    {
      fetch: async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.endsWith("/image/create")) {
          active += 1;
          activeCreates.push(active);
        } else {
          active = Math.max(0, active - 1);
        }
        return responses.shift()!;
      },
      sleep: async () => {},
    },
  );

  assert.deepEqual(activeCreates, [1, 1]);
  assert.deepEqual(
    result.map((image) => image.url),
    ["https://cdn.example/first.png", "https://cdn.example/second.png"],
  );
  assert.deepEqual(requests, [
    "https://api.pixai.art/v2/image/create",
    "https://api.pixai.art/v1/task/first",
    "https://api.pixai.art/v2/image/create",
    "https://api.pixai.art/v1/task/second",
  ]);
});

test("reports failed tasks and does not fetch their result again", async () => {
  let calls = 0;
  await assert.rejects(
    runPixAiGeneration(baseInput, {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ id: "failed-task" })
          : jsonResponse({ status: "failed" });
      },
      sleep: async () => {},
    }),
    /PixAI 任务失败/,
  );
  assert.equal(calls, 2);
});

test("rejects malformed create and completed responses", async (t) => {
  await t.test("missing task id", async () => {
    await assert.rejects(
      runPixAiGeneration(baseInput, {
        fetch: async () => jsonResponse({ status: "pending" }),
      }),
      /PixAI 未返回任务 ID/,
    );
  });

  await t.test("completed task without images", async () => {
    let calls = 0;
    await assert.rejects(
      runPixAiGeneration(baseInput, {
        fetch: async () => {
          calls += 1;
          return calls === 1
            ? jsonResponse({ id: "empty-task" })
            : jsonResponse({ status: "completed", outputs: {} });
        },
      }),
      /PixAI 未返回生成图片/,
    );
  });
});

test("times out pending PixAI tasks", async () => {
  let now = 0;
  let calls = 0;
  await assert.rejects(
    runPixAiGeneration(baseInput, {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ id: "queued-task" })
          : jsonResponse({ status: "pending" });
      },
      sleep: async () => {
        now += 6;
      },
      now: () => now,
      pollIntervalMs: 5,
      timeoutMs: 5,
    }),
    /PixAI 任务轮询超时/,
  );
});

test("aborts an in-flight PixAI request when the task deadline expires", async () => {
  let calls = 0;
  const generation = runPixAiGeneration(baseInput, {
    fetch: async (_input, init) => {
      calls += 1;
      if (calls === 1) return jsonResponse({ id: "hanging-task" });
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    },
    now: () => 0,
    timeoutMs: 5,
  });
  const testDeadline = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error("PixAI 请求仍处于挂起状态")), 100);
  });

  await assert.rejects(Promise.race([generation, testDeadline]), /PixAI 任务轮询超时/);
});

test("honors an already aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runPixAiGeneration({ ...baseInput, signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("preserves a user AbortError while a PixAI request is in flight", async () => {
  const controller = new AbortController();
  let calls = 0;
  const generation = runPixAiGeneration(
    { ...baseInput, signal: controller.signal },
    {
      fetch: async (_input, init) => {
        calls += 1;
        if (calls === 1) return jsonResponse({ id: "cancelled-task" });
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        });
      },
      timeoutMs: 1000,
    },
  );
  queueMicrotask(() => controller.abort());

  await assert.rejects(
    generation,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("rejects a missing API key before network access", async () => {
  let called = false;
  await assert.rejects(
    runPixAiGeneration(
      { ...baseInput, apiKey: "   " },
      {
        fetch: async () => {
          called = true;
          return jsonResponse({});
        },
      },
    ),
    /PixAI API Key 未配置/,
  );
  assert.equal(called, false);
});
