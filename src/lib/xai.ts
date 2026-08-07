import { loadSettings, aspectToWH, type ProviderId } from "./settings";
import { MODELSCOPE_IMAGE_MODEL, resolveImageModel } from "./provider-runtime.ts";
import { assertResponseOk } from "./http.ts";

export function currentProvider(): ProviderId {
  return loadSettings().provider;
}

export function providerLabel(id: ProviderId = currentProvider()): string {
  return id === "xai" ? "xAI/NewAPI" : id === "modelscope" ? "魔搭 ModelScope" : "Hugging Face";
}

export type ImageGenParams = {
  prompt: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: "1k" | "2k";
  model?: string;
};

export type ImageEditParams = {
  prompt: string;
  images: string[];
  n?: number;
  resolution?: "1k" | "2k";
  model?: string;
};

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

export type GeneratedImage = { url: string; revised_prompt?: string; mime_type?: string };

// Normalize an API image response item: prefer b64_json (CORS-free, persistable)
// and convert to a data URI so callers can use it as a normal URL.
type RawImage = { url?: string; b64_json?: string; revised_prompt?: string; mime_type?: string };
function normalizeImage(raw: RawImage): GeneratedImage {
  const mime = raw.mime_type || "image/png";
  if (raw.b64_json) {
    return { url: `data:${mime};base64,${raw.b64_json}`, revised_prompt: raw.revised_prompt, mime_type: mime };
  }
  return { url: raw.url || "", revised_prompt: raw.revised_prompt, mime_type: mime };
}

function getCfg() {
  const s = loadSettings();
  if (!s.apiKey) throw new Error("请先在设置中配置 API Key");
  return s;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = getCfg();
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  await assertResponseOk(res);
  return res.json();
}

export async function generateImages(p: ImageGenParams): Promise<GeneratedImage[]> {
  const cfg = loadSettings();
  const model = resolveImageModel(cfg.provider, p.model, {
    xai: cfg.imageModel,
    hf: cfg.hfModel || "Tongyi-MAI/Z-Image-Turbo",
  });
  if (cfg.provider === "modelscope") return generateImagesModelScope(p);
  if (cfg.provider === "hf") return generateImagesHF(p);
  const body = {
    model,
    prompt: p.prompt,
    n: p.n ?? 1,
    aspect_ratio: p.aspect_ratio ?? "1:1",
    resolution: p.resolution ?? "1k",
    response_format: "b64_json",
  };
  const data = await request<{ data: RawImage[] }>("/v1/images/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data.map(normalizeImage);
}

export async function editImages(p: ImageEditParams): Promise<GeneratedImage[]> {
  const cfg = loadSettings();
  if (cfg.provider !== "xai") {
    throw new Error(`当前来源（${providerLabel(cfg.provider)}）不支持图生图，请在设置中切换到 xAI / NewAPI。`);
  }
  const body: Record<string, unknown> = {
    model: p.model ?? cfg.imageModel,
    prompt: p.prompt,
    n: p.n ?? 1,
    resolution: p.resolution ?? "1k",
    response_format: "b64_json",
  };
  if (p.images.length === 1) {
    body.image = { url: p.images[0] };
  } else {
    body.images = p.images.map((url) => ({ url }));
  }
  const data = await request<{ data: RawImage[] }>("/v1/images/edits", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data.map(normalizeImage);
}

// ===== ModelScope (Tongyi-MAI/Z-Image-Turbo, async) =====
async function generateImagesModelScope(p: ImageGenParams): Promise<GeneratedImage[]> {
  const cfg = loadSettings();
  if (!cfg.modelscopeToken) throw new Error("请先在设置中配置 ModelScope Token");
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  const baseUrl = "https://api-inference.modelscope.cn";
  const headers = {
    Authorization: `Bearer ${cfg.modelscopeToken}`,
    "Content-Type": "application/json",
    "X-ModelScope-Async-Mode": "true",
  };
  const n = p.n ?? 1;
  const runOne = async (): Promise<GeneratedImage> => {
    const start = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODELSCOPE_IMAGE_MODEL,
        prompt: p.prompt,
        width, height,
        num_inference_steps: 9,
        guidance_scale: 0.0,
      }),
    });
    await assertResponseOk(start, "ModelScope");
    const { task_id } = (await start.json()) as { task_id: string };
    if (!task_id) throw new Error("ModelScope 未返回 task_id");
    while (true) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`${baseUrl}/v1/tasks/${task_id}`, {
        headers: { Authorization: `Bearer ${cfg.modelscopeToken}`, "X-ModelScope-Task-Type": "image_generation" },
      });
      await assertResponseOk(poll, "ModelScope poll");
      const data = (await poll.json()) as { task_status: string; output_images?: string[]; errors?: unknown };
      if (data.task_status === "SUCCEED") {
        const url = data.output_images?.[0];
        if (!url) throw new Error("ModelScope 未返回 output_images");
        return { url, mime_type: "image/png" };
      }
      if (data.task_status === "FAILED") throw new Error(`ModelScope 任务失败: ${JSON.stringify(data.errors)}`);
    }
  };
  const out: GeneratedImage[] = [];
  for (let i = 0; i < n; i++) out.push(await runOne());
  return out;
}

// ===== Hugging Face Inference API =====
async function generateImagesHF(p: ImageGenParams): Promise<GeneratedImage[]> {
  const cfg = loadSettings();
  if (!cfg.hfToken) throw new Error("请先在设置中配置 Hugging Face Token");
  const model = resolveImageModel("hf", p.model, {
    xai: cfg.imageModel,
    hf: cfg.hfModel || "Tongyi-MAI/Z-Image-Turbo",
  });
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  const n = p.n ?? 1;
  const runOne = async (): Promise<GeneratedImage> => {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.hfToken}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: p.prompt,
        parameters: { width, height, num_inference_steps: 9, seed: Math.floor(Math.random() * 1e9) },
      }),
    });
    await assertResponseOk(res, "HF");
    const blob = await res.blob();
    const dataUri: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { url: dataUri, mime_type: blob.type || "image/png" };
  };
  const out: GeneratedImage[] = [];
  for (let i = 0; i < n; i++) out.push(await runOne());
  return out;
}

export async function generateVideo(p: VideoGenParams): Promise<{ request_id: string }> {
  const cfg = loadSettings();
  if (cfg.provider !== "xai") {
    throw new Error(`当前来源（${providerLabel(cfg.provider)}）不支持视频，请在设置中切换到 xAI / NewAPI。`);
  }
  const body: Record<string, unknown> = {
    model: p.model ?? cfg.videoModel,
    prompt: p.prompt,
    duration: p.duration ?? 6,
    aspect_ratio: p.aspect_ratio ?? "16:9",
    resolution: p.resolution ?? "480p",
  };
  if (p.image) body.image = { url: p.image };
  if (p.reference_images?.length) body.reference_images = p.reference_images.map((url) => ({ url }));
  return request("/v1/videos/generations", { method: "POST", body: JSON.stringify(body) });
}

export async function editVideo(p: VideoEditParams): Promise<{ request_id: string }> {
  const cfg = loadSettings();
  return request("/v1/videos/edits", {
    method: "POST",
    body: JSON.stringify({
      model: p.model ?? cfg.videoModel,
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
  const cfg = loadSettings();
  return request("/v1/videos/extensions", {
    method: "POST",
    body: JSON.stringify({
      model: p.model ?? cfg.videoModel,
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
  messages: { role: "user" | "system" | "assistant"; content: string | ChatMessageContent[] }[];
}): Promise<string> {
  const data = await request<{ choices: { message: { content: string } }[] }>(
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
  return request(`/v1/videos/${requestId}`, { method: "GET" });
}

export function pollVideo(
  requestId: string,
  onUpdate: (s: VideoStatus) => void,
  intervalMs = 5000,
): { stop: () => void; promise: Promise<VideoStatus> } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<VideoStatus>((resolve, reject) => {
    const tick = async () => {
      if (stopped) return;
      try {
        const s = await getVideoStatus(requestId);
        onUpdate(s);
        if (s.status === "done" || s.status === "failed" || s.status === "expired") {
          resolve(s);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (e) {
        reject(e);
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
