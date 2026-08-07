import assert from "node:assert/strict";
import test from "node:test";
import { pixAiPoolImageProvider } from "./pixai-pool.ts";

test("blocks PixAI pool generation until its private web protocol is captured", async () => {
  await assert.rejects(
    pixAiPoolImageProvider.generateImages({ prompt: "portrait" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /imgapi\.qianyimwl\.top/);
      assert.match(error.message, /HAR|Network/);
      return true;
    },
  );
});
