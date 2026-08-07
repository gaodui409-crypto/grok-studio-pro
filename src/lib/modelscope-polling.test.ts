import assert from "node:assert/strict";
import test from "node:test";
import { pollModelScopeTask } from "./modelscope-polling.ts";

const noDelay = async () => {};

test("returns the first output image after success", async () => {
  const statuses = [
    { task_status: "RUNNING" },
    { task_status: "SUCCEED", output_images: ["https://example.test/result.png"] },
  ];
  const result = await pollModelScopeTask(async () => statuses.shift()!, {
    sleep: noDelay,
  });
  assert.equal(result, "https://example.test/result.png");
});

test("rejects known terminal failure states", async () => {
  await assert.rejects(
    pollModelScopeTask(
      async () => ({ task_status: "CANCELLED", errors: "quota" }),
      { sleep: noDelay },
    ),
    /CANCELLED.*quota/,
  );
});

test("times out pending tasks", async () => {
  let now = 0;
  await assert.rejects(
    pollModelScopeTask(async () => ({ task_status: "RUNNING" }), {
      sleep: async () => {
        now += 6;
      },
      now: () => now,
      timeoutMs: 5,
    }),
    /超时/,
  );
});

test("honors an aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    pollModelScopeTask(async () => ({ task_status: "RUNNING" }), {
      signal: controller.signal,
      sleep: noDelay,
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});
