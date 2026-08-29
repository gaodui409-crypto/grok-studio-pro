import assert from "node:assert/strict";
import test from "node:test";
import { fetchProviderModels, mergeModels, supportsModelListing } from "./provider-models.ts";
import type { ModelSpec } from "./provider-catalog.ts";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("knows which providers publish a model list", () => {
  assert.equal(supportsModelListing("gitee"), true);
  assert.equal(supportsModelListing("pollinations"), true);
  assert.equal(supportsModelListing("aihorde"), true);
  // ModelScope's /v1/models returns only LLM and audio models — Z-Image-Turbo is
  // not in it — so it must keep the hand-written catalog.
  assert.equal(supportsModelListing("modelscope"), false);
  assert.equal(supportsModelListing("xai"), false);
});

test("rejects a fetch for a provider with no endpoint", async () => {
  await assert.rejects(() => fetchProviderModels("modelscope"), /没有可用的模型列表接口/);
});

test("keeps only image models out of Gitee's mixed list", async () => {
  const models = await fetchProviderModels("gitee", {
    fetch: async () =>
      jsonResponse({
        data: [
          { id: "z-image-turbo" },
          { id: "FLUX.2-dev" },
          { id: "wan3.0-video" },
          { id: "Qwen-Image-Edit" },
          { id: "some-chat-instruct" },
          { id: "whisper-large" },
        ],
      }),
  });
  const ids = models.map((model) => model.id);
  assert.ok(ids.includes("z-image-turbo"));
  assert.ok(ids.includes("FLUX.2-dev"));
  // "wan3.0-video" matches nothing image-ish; the other two are explicitly excluded.
  assert.ok(!ids.includes("wan3.0-video"));
  assert.ok(!ids.includes("some-chat-instruct"));
  assert.ok(!ids.includes("whisper-large"));
});

test("reads Pollinations' bare string array", async () => {
  const models = await fetchProviderModels("pollinations", {
    fetch: async () => jsonResponse(["sana", "flux"]),
  });
  assert.deepEqual(
    models.map((model) => model.id),
    ["sana", "flux"],
  );
});

test("sorts AI Horde models by worker count and shows it", async () => {
  const models = await fetchProviderModels("aihorde", {
    fetch: async () =>
      jsonResponse([
        { name: "Quiet Model", count: 1 },
        { name: "Busy Model", count: 12 },
        { name: "Offline Model", count: 0 },
      ]),
  });
  assert.deepEqual(
    models.map((model) => model.id),
    ["Busy Model", "Quiet Model", "Offline Model"],
  );
  assert.equal(models[0].label, "Busy Model（12 台）");
  // Zero workers means the job would queue forever, so no count is appended.
  assert.equal(models[2].label, "Offline Model");
});

test("surfaces an HTTP failure instead of returning an empty list", async () => {
  await assert.rejects(
    () =>
      fetchProviderModels("gitee", {
        fetch: async () => new Response("nope", { status: 503 }),
      }),
    /HTTP 503/,
  );
});

test("merge keeps curated entries and their metadata, appending only new ids", () => {
  const curated: ModelSpec[] = [{ id: "flux", label: "flux（默认）", maxEdge: 2048, steps: 30 }];
  const fetched: ModelSpec[] = [
    { id: "flux", label: "flux" },
    { id: "sana", label: "sana" },
  ];
  const merged = mergeModels(curated, fetched);

  assert.deepEqual(
    merged.map((model) => model.id),
    ["flux", "sana"],
  );
  // The curated entry wins: it carries maxEdge/steps that the fetch cannot know.
  assert.equal(merged[0].maxEdge, 2048);
  assert.equal(merged[0].steps, 30);
});

test("merge never drops a curated model the endpoint omits", () => {
  // Pollinations' /models returns only ["sana"] while flux is the documented
  // default — replacing instead of merging would delete a working model.
  const merged = mergeModels(
    [
      { id: "flux", label: "flux（默认）" },
      { id: "sana", label: "sana" },
    ],
    [{ id: "sana", label: "sana" }],
  );
  assert.deepEqual(
    merged.map((model) => model.id),
    ["flux", "sana"],
  );
});
