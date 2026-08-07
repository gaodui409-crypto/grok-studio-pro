import { assertResponseOk } from "../http.ts";
import { pollModelScopeTask, type ModelScopeTaskStatus } from "../modelscope-polling.ts";
import { MODELSCOPE_IMAGE_MODEL } from "../provider-runtime.ts";
import { aspectToWH, loadSettings } from "../settings.ts";
import type { GeneratedImage, ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams): Promise<GeneratedImage[]> {
  const settings = loadSettings();
  if (!settings.modelscopeToken) {
    throw new Error("请先在设置中配置 ModelScope Token");
  }

  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");
  const baseUrl = "https://api-inference.modelscope.cn";
  const headers = {
    Authorization: `Bearer ${settings.modelscopeToken}`,
    "Content-Type": "application/json",
    "X-ModelScope-Async-Mode": "true",
  };

  const runOne = async (): Promise<GeneratedImage> => {
    const start = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      signal: p.signal,
      headers,
      body: JSON.stringify({
        model: MODELSCOPE_IMAGE_MODEL,
        prompt: p.prompt,
        width,
        height,
        num_inference_steps: 9,
        guidance_scale: 0.0,
      }),
    });
    await assertResponseOk(start, "ModelScope");
    const { task_id } = (await start.json()) as { task_id: string };
    if (!task_id) throw new Error("ModelScope 未返回 task_id");

    const url = await pollModelScopeTask(
      async () => {
        const poll = await fetch(`${baseUrl}/v1/tasks/${task_id}`, {
          signal: p.signal,
          headers: {
            Authorization: `Bearer ${settings.modelscopeToken}`,
            "X-ModelScope-Task-Type": "image_generation",
          },
        });
        await assertResponseOk(poll, "ModelScope poll");
        return poll.json() as Promise<ModelScopeTaskStatus>;
      },
      { signal: p.signal },
    );
    return { url, mime_type: "image/png" };
  };

  const output: GeneratedImage[] = [];
  for (let i = 0; i < (p.n ?? 1); i++) output.push(await runOne());
  return output;
}

export const modelScopeImageProvider: ImageProviderAdapter = {
  id: "modelscope",
  label: "魔搭 ModelScope",
  generateImages,
};
