import { loadSettings, type ProviderId } from "./settings.ts";
import { imageProviderRegistry } from "./providers/index.ts";
import { xaiRequest } from "./providers/xai-client.ts";
import type { ImageEditParams, ImageGenParams } from "./providers/types.ts";

export type { GeneratedImage, ImageEditParams, ImageGenParams } from "./providers/types.ts";

export function currentProvider(): ProviderId {
  return loadSettings().provider;
}

export function providerLabel(id: ProviderId = currentProvider()): string {
  return imageProviderRegistry.get(id).label;
}

export async function generateImages(p: ImageGenParams) {
  return imageProviderRegistry.get(currentProvider()).generateImages(p);
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

export async function generateVideo(p: VideoGenParams): Promise<{ request_id: string }> {
  const settings = loadSettings();
  if (settings.provider !== "xai") {
    throw new Error(
      `当前来源（${providerLabel(settings.provider)}）不支持视频，请在设置中切换到 xAI / NewAPI。`,
    );
  }
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
  const settings = loadSettings();
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
  const settings = loadSettings();
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
}): Promise<string> {
  const data = await xaiRequest<{ choices: { message: { content: string } }[] }>(
    "/v1/chat/completions",
    {
      method: "POST",
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

export function pollVideo(
  requestId: string,
  onUpdate: (status: VideoStatus) => void,
  intervalMs = 5000,
): { stop: () => void; promise: Promise<VideoStatus> } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<VideoStatus>((resolve, reject) => {
    const tick = async () => {
      if (stopped) return;
      try {
        const status = await getVideoStatus(requestId);
        onUpdate(status);
        if (status.status === "done" || status.status === "failed" || status.status === "expired") {
          resolve(status);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (error) {
        reject(error);
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

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
