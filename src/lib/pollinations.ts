import { assertResponseOk, type FetchLike } from "./http.ts";
import { runSequentialBatch } from "./partial-batch.ts";
import type { GeneratedImage } from "./providers/types.ts";

const POLLINATIONS_IMAGE_URL = "https://gen.pollinations.ai/image";

type PollinationsUrlInput = {
  prompt: string;
  apiKey: string;
  model: string;
  width: number;
  height: number;
  seed: number;
};

type PollinationsGenerationInput = Omit<PollinationsUrlInput, "seed"> & {
  count: number;
  signal?: AbortSignal;
};

type PollinationsDependencies = {
  fetch?: FetchLike;
  random?: () => number;
};

export function buildPollinationsImageUrl(input: PollinationsUrlInput): string {
  const url = new URL(`${POLLINATIONS_IMAGE_URL}/${encodeURIComponent(input.prompt)}`);
  url.searchParams.set("key", input.apiKey);
  url.searchParams.set("model", input.model);
  url.searchParams.set("width", String(input.width));
  url.searchParams.set("height", String(input.height));
  url.searchParams.set("seed", String(input.seed));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  url.searchParams.set("safe", "true");
  return url.toString();
}

export async function blobToDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function generatePollinationsImages(
  input: PollinationsGenerationInput,
  dependencies: PollinationsDependencies = {},
): Promise<GeneratedImage[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("请先在设置中配置 Pollinations API Key");

  const { fetch: fetchImpl = fetch, random = Math.random } = dependencies;
  return runSequentialBatch(input.count, async (index) => {
    input.signal?.throwIfAborted();
    const url = buildPollinationsImageUrl({
      ...input,
      apiKey,
      seed: Math.floor(random() * 1_000_000_000),
    });
    const response = await fetchImpl(url, { signal: input.signal });
    await assertResponseOk(response, "Pollinations");
    const blob = await response.blob();
    return {
      url: await blobToDataUri(blob),
      mime_type: blob.type || "image/jpeg",
    };
  });
}
