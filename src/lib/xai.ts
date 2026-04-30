import { loadSettings } from "./settings";

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
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.error?.message || data?.error || data?.message || msg;
    } catch {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function generateImages(p: ImageGenParams): Promise<GeneratedImage[]> {
  const cfg = loadSettings();
  const body = {
    model: p.model ?? cfg.imageModel,
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

export async function generateVideo(p: VideoGenParams): Promise<{ request_id: string }> {
  const cfg = loadSettings();
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
