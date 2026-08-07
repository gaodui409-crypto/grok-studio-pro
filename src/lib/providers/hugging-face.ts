import { assertResponseOk } from "../http.ts";
import { resolveImageModel } from "../provider-runtime.ts";
import { aspectToWH, loadSettings } from "../settings.ts";
import type { GeneratedImage, ImageGenParams, ImageProviderAdapter } from "./types.ts";

async function generateImages(p: ImageGenParams): Promise<GeneratedImage[]> {
  const settings = loadSettings();
  if (!settings.hfToken) {
    throw new Error("请先在设置中配置 Hugging Face Token");
  }

  const model = resolveImageModel("hf", p.model, {
    xai: settings.imageModel,
    hf: settings.hfModel || "Tongyi-MAI/Z-Image-Turbo",
  });
  const { width, height } = aspectToWH(p.aspect_ratio ?? "1:1", p.resolution ?? "1k");

  const runOne = async (): Promise<GeneratedImage> => {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      signal: p.signal,
      headers: {
        Authorization: `Bearer ${settings.hfToken}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: p.prompt,
        parameters: {
          width,
          height,
          num_inference_steps: 9,
          seed: Math.floor(Math.random() * 1e9),
        },
      }),
    });
    await assertResponseOk(response, "HF");
    const blob = await response.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { url: dataUri, mime_type: blob.type || "image/png" };
  };

  const output: GeneratedImage[] = [];
  for (let i = 0; i < (p.n ?? 1); i++) output.push(await runOne());
  return output;
}

export const huggingFaceImageProvider: ImageProviderAdapter = {
  id: "hf",
  label: "Hugging Face",
  generateImages,
};
