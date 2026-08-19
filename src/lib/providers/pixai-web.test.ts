import assert from "node:assert/strict";
import test from "node:test";
import { PIXAI_WEB_GRAPHQL_URL } from "../pixai-web-client.ts";
import { pixAiWebDimensions, pixAiWebImageProvider } from "./pixai-web.ts";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("maps shared aspect ratios and resolution tiers to PixAI web dimensions", () => {
  assert.deepEqual(pixAiWebDimensions("16:9", "1k"), { width: 1024, height: 576 });
  assert.deepEqual(pixAiWebDimensions("9:16", "2k"), { width: 864, height: 1536 });
});

test("rejects the automatic aspect ratio before creating a PixAI web task", () => {
  assert.throws(() => pixAiWebDimensions("auto", "1k"), /PixAI 网页.*auto/);
});

test("uses web credentials and model ID when creating a GraphQL task", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  const responses = [
    jsonResponse({ data: { createGenerationTask: { id: "web-task" } } }),
    jsonResponse({
      data: {
        task: {
          id: "web-task",
          status: "completed",
          outputs: { mediaId: "media-1" },
        },
      },
    }),
    jsonResponse({
      data: { media: { fileUrl: "https://cdn.example/web.png", urls: [] } },
    }),
  ];

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        assert.equal(key, "grok-studio-settings");
        return JSON.stringify({
          provider: "pixai-web",
          pixaiApiKey: "official-key-must-not-be-used",
          pixaiModelVersionId: "official-model-must-not-be-used",
          pixaiWebToken: "web-token",
          pixaiWebModelId: "web-model",
        });
      },
    },
  });
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    assert.ok(response, "unexpected GraphQL request");
    return response;
  };

  try {
    const result = await pixAiWebImageProvider.generateImages({
      prompt: "fox under moonlight",
      aspect_ratio: "16:9",
      resolution: "1k",
      n: 1,
    });

    assert.deepEqual(result, [{ url: "https://cdn.example/web.png", mime_type: "image/png" }]);
    assert.equal(requests[0]?.url, PIXAI_WEB_GRAPHQL_URL);
    assert.equal(new Headers(requests[0]?.init?.headers).get("authorization"), "Bearer web-token");
    const body = JSON.parse(String(requests[0]?.init?.body));
    assert.equal(body.variables.parameters.prompts, "fox under moonlight");
    assert.equal(body.variables.parameters.modelId, "web-model");
    assert.equal(body.variables.parameters.width, 1024);
    assert.equal(body.variables.parameters.height, 576);
    assert.doesNotMatch(String(requests[0]?.init?.body), /official-key-must-not-be-used/);
    assert.doesNotMatch(String(requests[0]?.init?.body), /official-model-must-not-be-used/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
});
