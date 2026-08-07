import type { ImageProviderAdapter } from "./types.ts";

const PROTOCOL_REQUIRED_MESSAGE =
  "PixAI 号池（imgapi.qianyimwl.top）已加入渠道列表，但网页未公开生成接口协议。请提供一次生成的 HAR，或 DevTools Network 中的请求与响应详情后再启用。";

export const pixAiPoolImageProvider: ImageProviderAdapter = {
  id: "pixai-pool",
  label: "PixAI 号池",
  async generateImages() {
    throw new Error(PROTOCOL_REQUIRED_MESSAGE);
  },
};
