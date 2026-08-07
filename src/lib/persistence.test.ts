import assert from "node:assert/strict";
import test from "node:test";
import { attemptPersistence } from "./persistence.ts";

test("reports successful persistence", async () => {
  assert.deepEqual(await attemptPersistence(async () => {}), { saved: true });
});

test("captures persistence failures without throwing", async () => {
  const result = await attemptPersistence(async () => {
    throw new Error("quota exceeded");
  });
  assert.equal(result.saved, false);
  if (!result.saved) assert.equal(result.error.message, "quota exceeded");
});
