import { assertResponseOk, type FetchLike } from "./http.ts";
import type { GeneratedImage } from "./providers/types.ts";

const GITEE_IMAGE_URL = "https://ai.gitee.com/v1/images/generations";

export const GITEE_DEFAULT_MODEL = "z-image-turbo";

// Gitee AI caps generated images at 2048 on either edge.
export const GITEE_MAX_EDGE = 2048;

type GiteeGenerationInput = {
  prompt: string;
  apiKey: string;
  model: string;
  width: number;
  height: number;
  count: number;
  signal?: AbortSignal;
};

type GiteeDependencies = {
  fetch?: FetchLike;
};

type GiteeImage = {
  b64_json?: string;
  url?: string;
};

export function clampGiteeEdge(value: number): number {
  return Math.max(8, Math.min(GITEE_MAX_EDGE, value));
}

export function buildGiteeRequestBody(
  input: Pick<GiteeGenerationInput, "prompt" | "model" | "width" | "height">,
): Record<string, unknown> {
  const width = clampGiteeEdge(input.width);
  const height = clampGiteeEdge(input.height);
  return {
    model: input.model,
    prompt: input.prompt,
    // The endpoint is OpenAI-compatible, so it takes `size`, plus Gitee's own
    // width/height extension. Send both so neither reading of the spec loses.
    size: `${width}x${height}`,
    width,
    height,
    num_inference_steps: 9,
  };
}

export function normalizeGiteeImage(raw: GiteeImage): GeneratedImage {
  if (raw.b64_json) {
    return { url: `data:image/png;base64,${raw.b64_json}`, mime_type: "image/png" };
  }
  // Returned CDN URLs are used as-is: re-fetching them for a data URI would need
  // CORS on the image host, which Gitee does not promise.
  if (raw.url) return { url: raw.url, mime_type: "image/png" };
  throw new Error("Gitee AI 返回的数据里既没有 url 也没有 b64_json");
}

export async function generateGiteeImages(
  input: GiteeGenerationInput,
  dependencies: GiteeDependencies = {},
): Promise<GeneratedImage[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("请先在设置中配置 Gitee AI API Key");

  const model = input.model.trim() || GITEE_DEFAULT_MODEL;
  const { fetch: fetchImpl = fetch } = dependencies;
  const images: GeneratedImage[] = [];

  for (let index = 0; index < input.count; index += 1) {
    input.signal?.throwIfAborted();
    const response = await fetchImpl(GITEE_IMAGE_URL, {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Failover-Enabled": "true",
      },
      body: JSON.stringify(buildGiteeRequestBody({ ...input, model })),
    });
    await assertResponseOk(response, "Gitee AI");
    const payload = (await response.json()) as { data?: GiteeImage[] };
    const first = payload.data?.[0];
    if (!first) throw new Error("Gitee AI 未返回图片数据");
    images.push(normalizeGiteeImage(first));
  }

  return images;
}
