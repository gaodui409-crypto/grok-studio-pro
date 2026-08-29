import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGiteeRequestBody,
  clampGiteeEdge,
  generateGiteeImages,
  normalizeGiteeImage,
  GITEE_DEFAULT_MODEL,
} from "./gitee.ts";

test("sends both the OpenAI size field and Gitee's width/height extension", () => {
  const body = buildGiteeRequestBody({
    prompt: "a paper crane",
    model: "z-image-turbo",
    width: 1024,
    height: 576,
  });

  assert.equal(body.model, "z-image-turbo");
  assert.equal(body.prompt, "a paper crane");
  assert.equal(body.size, "1024x576");
  assert.equal(body.width, 1024);
  assert.equal(body.height, 576);
  assert.equal(body.num_inference_steps, 9);
});

test("clamps requested edges to the documented 2048 ceiling", () => {
  assert.equal(clampGiteeEdge(1024), 1024);
  assert.equal(clampGiteeEdge(4096), 2048);
  assert.equal(clampGiteeEdge(0), 8);
});

test("clamps oversized dimensions inside the request body", () => {
  const body = buildGiteeRequestBody({
    prompt: "test",
    model: GITEE_DEFAULT_MODEL,
    width: 4096,
    height: 3000,
  });

  assert.equal(body.size, "2048x2048");
  assert.equal(body.width, 2048);
  assert.equal(body.height, 2048);
});

test("turns a base64 payload into a gallery-compatible data URI", () => {
  assert.deepEqual(normalizeGiteeImage({ b64_json: "AAEC" }), {
    url: "data:image/png;base64,AAEC",
    mime_type: "image/png",
  });
});

test("passes a returned CDN URL through without re-fetching it", () => {
  assert.deepEqual(normalizeGiteeImage({ url: "https://cdn.example/z.png" }), {
    url: "https://cdn.example/z.png",
    mime_type: "image/png",
  });
});

test("reports a response carrying neither url nor b64_json", () => {
  assert.throws(() => normalizeGiteeImage({}), /既没有 url 也没有 b64_json/);
});

test("rejects a missing API key before making a request", async () => {
  let calls = 0;
  await assert.rejects(
    generateGiteeImages(
      {
        prompt: "test",
        apiKey: "  ",
        model: GITEE_DEFAULT_MODEL,
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        fetch: async () => {
          calls += 1;
          return new Response();
        },
      },
    ),
    /请先在设置中配置 Gitee AI API Key/,
  );
  assert.equal(calls, 0);
});

test("authenticates with a bearer token and the failover header", async () => {
  let seen: RequestInit | undefined;
  await generateGiteeImages(
    {
      prompt: "test",
      apiKey: "gitee-key",
      model: GITEE_DEFAULT_MODEL,
      width: 1024,
      height: 1024,
      count: 1,
    },
    {
      fetch: async (_input, init) => {
        seen = init;
        return new Response(JSON.stringify({ data: [{ b64_json: "AAEC" }] }));
      },
    },
  );

  const headers = seen?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer gitee-key");
  assert.equal(headers["X-Failover-Enabled"], "true");
  assert.equal(seen?.method, "POST");
});

test("falls back to the default model when the setting is blank", async () => {
  let body: Record<string, unknown> = {};
  await generateGiteeImages(
    {
      prompt: "test",
      apiKey: "gitee-key",
      model: "   ",
      width: 1024,
      height: 1024,
      count: 1,
    },
    {
      fetch: async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ data: [{ b64_json: "AAEC" }] }));
      },
    },
  );

  assert.equal(body.model, GITEE_DEFAULT_MODEL);
});

test("generates multiple images serially", async () => {
  let calls = 0;
  const results = await generateGiteeImages(
    {
      prompt: "test",
      apiKey: "gitee-key",
      model: GITEE_DEFAULT_MODEL,
      width: 1024,
      height: 1024,
      count: 3,
    },
    {
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({ data: [{ b64_json: `img${calls}` }] }));
      },
    },
  );

  assert.equal(calls, 3);
  assert.deepEqual(
    results.map((image) => image.url),
    ["data:image/png;base64,img1", "data:image/png;base64,img2", "data:image/png;base64,img3"],
  );
});

test("surfaces an empty data array instead of returning a broken image", async () => {
  await assert.rejects(
    generateGiteeImages(
      {
        prompt: "test",
        apiKey: "gitee-key",
        model: GITEE_DEFAULT_MODEL,
        width: 1024,
        height: 1024,
        count: 1,
      },
      { fetch: async () => new Response(JSON.stringify({ data: [] })) },
    ),
    /Gitee AI 未返回图片数据/,
  );
});

test("stops before the next request once the signal aborts", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    generateGiteeImages(
      {
        prompt: "test",
        apiKey: "gitee-key",
        model: GITEE_DEFAULT_MODEL,
        width: 1024,
        height: 1024,
        count: 3,
        signal: controller.signal,
      },
      {
        fetch: async () => {
          calls += 1;
          controller.abort();
          return new Response(JSON.stringify({ data: [{ b64_json: "AAEC" }] }));
        },
      },
    ),
    (error: Error) => error.name === "AbortError",
  );
  assert.equal(calls, 1);
});
