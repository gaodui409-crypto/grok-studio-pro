import { loadSettings, type ProviderId, type Settings } from "./settings.ts";
import { imageProviderRegistry } from "./providers/index.ts";
import { xaiRequest } from "./providers/xai-client.ts";
import { chooseProvider } from "./provider-fallback.ts";
import { recordUsage } from "./quota.ts";
import type { GeneratedImage, ImageEditParams, ImageGenParams } from "./providers/types.ts";

export type { GeneratedImage, ImageEditParams, ImageGenParams } from "./providers/types.ts";

export function currentProvider(): ProviderId {
  return loadSettings().provider;
}

export function providerLabel(id: ProviderId = currentProvider()): string {
  return imageProviderRegistry.get(id).label;
}

export type GenerateImagesOutcome = {
  images: GeneratedImage[];
  /** Which channel actually served the request. */
  provider: ProviderId;
  /** Set when the local quota tally redirected away from the chosen channel. */
  switchedFrom?: ProviderId;
};

// Opt-in entry point for the quota-aware path: picks a channel via
// chooseProvider (which redirects away from ones the local tally says are spent)
// and reports which one actually ran, so a caller can tell the user about the
// switch. NOT yet used by any page — the quota UI is deferred, and redirecting
// channels with nothing on screen to explain it would leave the user staring at a
// result from a provider they did not choose.
export async function generateImagesWithFallback(
  p: ImageGenParams,
): Promise<GenerateImagesOutcome> {
  const settings = loadSettings();
  const choice = chooseProvider(settings);
  const images = await imageProviderRegistry.get(choice.provider).generateImages(p);
  recordUsage(choice.provider, images.length);
  return { images, provider: choice.provider, switchedFrom: choice.switchedFrom };
}

export async function generateImages(p: ImageGenParams) {
  const provider = currentProvider();
  const images = await imageProviderRegistry.get(provider).generateImages(p);
  // Counting runs now even though the redirect does not: it only writes to
  // localStorage, so it changes nothing the user can see, and it means the ledger
  // already holds real history on the day the quota UI ships. Counted after the
  // await on the length actually returned — a rejected request consumed nothing,
  // and a partial batch consumed only what came back.
  recordUsage(provider, images.length);
  return images;
}

export async function editImages(p: ImageEditParams) {
  return imageProviderRegistry.requireImageEditing(currentProvider()).editImages(p);
}

export type VideoGenParams = {
  prompt: string;
  duration?: number;
  aspect_ratio?: string;
  resolution?: "480p" | "720p";
  image?: string;
  reference_images?: string[];
  model?: string;
};

export type VideoEditParams = {
  prompt: string;
  video: string;
  model?: string;
};

export type VideoStatus = {
  status: "pending" | "done" | "failed" | "expired";
  progress?: number;
  video?: { url: string; duration?: number };
  model?: string;
  error?: string;
};

// Video and multimodal chat are xAI-only. Every entry point that reaches
// xaiRequest for these features must go through here first — otherwise a stale
// apiKey left in localStorage would silently fire at xAI while the UI shows a
// different provider, and an empty key would report "配置 API Key" instead of
// the real reason (the selected provider has no such feature).
function requireXaiProvider(feature: string): Settings {
  const settings = loadSettings();
  if (settings.provider !== "xai") {
    throw new Error(
      `当前来源（${providerLabel(settings.provider)}）不支持${feature}，请在设置中切换到 xAI / NewAPI。`,
    );
  }
  return settings;
}

export async function generateVideo(p: VideoGenParams): Promise<{ request_id: string }> {
  const settings = requireXaiProvider("视频");
  const body: Record<string, unknown> = {
    model: p.model ?? settings.videoModel,
    prompt: p.prompt,
    duration: p.duration ?? 6,
    aspect_ratio: p.aspect_ratio ?? "16:9",
    resolution: p.resolution ?? "480p",
  };
  if (p.image) body.image = { url: p.image };
  if (p.reference_images?.length) {
    body.reference_images = p.reference_images.map((url) => ({ url }));
  }
  return xaiRequest("/v1/videos/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function editVideo(p: VideoEditParams): Promise<{ request_id: string }> {
  const settings = requireXaiProvider("视频编辑");
  return xaiRequest("/v1/videos/edits", {
    method: "POST",
    body: JSON.stringify({
      model: p.model ?? settings.videoModel,
      prompt: p.prompt,
      video: { url: p.video },
    }),
  });
}

export type VideoExtendParams = {
  prompt: string;
  video: string;
  duration?: number;
  model?: string;
};

export async function extendVideo(p: VideoExtendParams): Promise<{ request_id: string }> {
  const settings = requireXaiProvider("视频延长");
  return xaiRequest("/v1/videos/extensions", {
    method: "POST",
    body: JSON.stringify({
      model: p.model ?? settings.videoModel,
      prompt: p.prompt,
      video: { url: p.video },
      duration: p.duration ?? 6,
    }),
  });
}

export type ChatMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function chatCompletion(params: {
  model?: string;
  messages: {
    role: "user" | "system" | "assistant";
    content: string | ChatMessageContent[];
  }[];
  signal?: AbortSignal;
}): Promise<string> {
  requireXaiProvider("文字识别翻译");
  const data = await xaiRequest<{ choices: { message: { content: string } }[] }>(
    "/v1/chat/completions",
    {
      method: "POST",
      signal: params.signal,
      body: JSON.stringify({
        model: params.model ?? "grok-4.20-0309-non-reasoning",
        messages: params.messages,
      }),
    },
  );
  return data.choices?.[0]?.message?.content ?? "";
}

export async function getVideoStatus(requestId: string): Promise<VideoStatus> {
  return xaiRequest(`/v1/videos/${requestId}`, { method: "GET" });
}

/** Consecutive status-GET failures tolerated before the poll gives up. */
export const POLL_MAX_CONSECUTIVE_ERRORS = 3;

export function pollVideo(
  requestId: string,
  onUpdate: (status: VideoStatus) => void,
  intervalMs = 5000,
): { stop: () => void; promise: Promise<VideoStatus> } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<VideoStatus>((resolve, reject) => {
    // A status GET is not the job. The video is already rendering on xAI's side
    // and is already billable, so rejecting on the first 502 threw away tracking
    // of something the user had paid for — over a request that costs nothing to
    // repeat. Retry a few times, then report the last error.
    let consecutiveErrors = 0;
    const tick = async () => {
      if (stopped) return;
      try {
        const status = await getVideoStatus(requestId);
        consecutiveErrors = 0;
        onUpdate(status);
        if (status.status === "done" || status.status === "failed" || status.status === "expired") {
          resolve(status);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= POLL_MAX_CONSECUTIVE_ERRORS) {
          reject(error);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      }
    };
    tick();
  });
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    promise,
  };
}

/**
 * Takes a `Blob`, not just a `File`: pages unpacked from a CBZ are Blobs with no
 * file behind them, and `readAsDataURL` never needed the narrower type. Every
 * existing caller passes a File, which is a Blob.
 */
export function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
