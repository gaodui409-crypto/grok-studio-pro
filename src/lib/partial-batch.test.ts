import assert from "node:assert/strict";
import test from "node:test";
import { PartialBatchError, runSequentialBatch } from "./partial-batch.ts";

test("保留部分成功结果并携带第一个失败原因", async () => {
  let calls = 0;
  await assert.rejects(
    runSequentialBatch(3, async () => {
      calls += 1;
      if (calls === 2) throw new Error("rate limited");
      return `image-${calls}`;
    }),
    (error: unknown) => {
      assert.ok(error instanceof PartialBatchError);
      assert.deepEqual(error.results, ["image-1"]);
      assert.equal(error.failedIndex, 1);
      assert.equal(error.cause.message, "rate limited");
      return true;
    },
  );
  assert.equal(calls, 2);
});

test("整批第一项失败时保留原始错误类型", async () => {
  const error = new Error("unauthorized");
  await assert.rejects(
    runSequentialBatch(2, async () => {
      throw error;
    }),
    (actual: unknown) => actual === error,
  );
});
