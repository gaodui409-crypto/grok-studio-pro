import type { ProviderId, ResolutionTier, Settings } from "../settings.ts";

export type ImageGenParams = {
  prompt: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: ResolutionTier;
  model?: string;
  signal?: AbortSignal;
};

export type ImageEditParams = {
  prompt: string;
  images: string[];
  n?: number;
  resolution?: ResolutionTier;
  model?: string;
  signal?: AbortSignal;
};

export type GeneratedImage = {
  url: string;
  revised_prompt?: string;
  mime_type?: string;
};

export type ImageProviderAdapter = {
  id: ProviderId;
  label: string;
  generateImages(params: ImageGenParams, settings?: Settings): Promise<GeneratedImage[]>;
  editImages?(params: ImageEditParams, settings?: Settings): Promise<GeneratedImage[]>;
};

export type ImageEditingProviderAdapter = ImageProviderAdapter &
  Required<Pick<ImageProviderAdapter, "editImages">>;
