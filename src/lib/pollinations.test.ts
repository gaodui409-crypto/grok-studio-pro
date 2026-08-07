import assert from "node:assert/strict";
import test from "node:test";
import {
  blobToDataUri,
  buildPollinationsImageUrl,
  generatePollinationsImages,
} from "./pollinations.ts";

test("builds an encoded image URL with explicit generation controls", () => {
  const url = new URL(
    buildPollinationsImageUrl({
      prompt: "cat & dog / poster",
      apiKey: "pk_test",
      model: "flux",
      width: 1024,
      height: 576,
      seed: 42,
    }),
  );

  assert.equal(url.origin, "https://gen.pollinations.ai");
  assert.equal(decodeURIComponent(url.pathname), "/image/cat & dog / poster");
  assert.equal(url.searchParams.get("key"), "pk_test");
  assert.equal(url.searchParams.get("model"), "flux");
  assert.equal(url.searchParams.get("width"), "1024");
  assert.equal(url.searchParams.get("height"), "576");
  assert.equal(url.searchParams.get("seed"), "42");
  assert.equal(url.searchParams.get("nologo"), "true");
  assert.equal(url.searchParams.get("private"), "true");
  assert.equal(url.searchParams.get("safe"), "true");
});

test("converts image blobs into gallery-compatible data URIs", async () => {
  const result = await blobToDataUri(
    new Blob([new Uint8Array([0, 1, 2, 255])], {
      type: "image/png",
    }),
  );
  assert.equal(result, "data:image/png;base64,AAEC/w==");
});

test("rejects a missing API key before making a request", async () => {
  let calls = 0;
  await assert.rejects(
    generatePollinationsImages(
      {
        prompt: "test",
        apiKey: "  ",
        model: "flux",
        width: 512,
        height: 512,
        count: 1,
      },
      {
        fetch: async () => {
          calls += 1;
          return new Response();
        },
      },
    ),
    /请先在设置中配置 Pollinations API Key/,
  );
  assert.equal(calls, 0);
});

test("generates multiple images serially with independent seeds", async () => {
  const requestedUrls: string[] = [];
  const randomValues = [0.1, 0.2];
  const results = await generatePollinationsImages(
    {
      prompt: "paper city",
      apiKey: "pk_live",
      model: "turbo",
      width: 768,
      height: 1024,
      count: 2,
    },
    {
      random: () => randomValues.shift()!,
      fetch: async (input) => {
        requestedUrls.push(String(input));
        return new Response(
          new Blob([new Uint8Array([requestedUrls.length])], {
            type: "image/webp",
          }),
        );
      },
    },
  );

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((image) => image.mime_type),
    ["image/webp", "image/webp"],
  );
  assert.deepEqual(
    requestedUrls.map((value) => new URL(value).searchParams.get("seed")),
    ["100000000", "200000000"],
  );
});
