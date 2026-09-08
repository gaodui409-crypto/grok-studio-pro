import { signRequest } from "./hmac.ts";
import {
  isAllowedPicaImageUrl,
  limitedResponseBody,
  MAX_IMAGE_RESPONSE_BYTES,
  nextPicaImageUrl,
} from "./relay-security.ts";

const PICA_HOST = "https://picaapi.picacomic.com/";
const MAX_API_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export type PicaApiResult = { status: number; body: string };
export type PicaApiRequestArgs = {
  method: "GET" | "POST";
  path: string;
  body: string | null;
  token: string | null;
};
export type OutboundInit = Omit<RequestInit, "body" | "headers"> & {
  body?: string;
  headers?: Record<string, string>;
};
export type OutboundFetch = (url: string, init: OutboundInit) => Promise<Response>;

async function discard(response: Response) {
  await response.body?.cancel().catch(() => {});
}

export async function relayPicaApi(
  data: PicaApiRequestArgs,
  send: OutboundFetch,
): Promise<PicaApiResult> {
  const { path, method, body, token } = data;
  const time = String(Math.floor(Date.now() / 1000));
  const signature = await signRequest(path, method, time);
  const headers: Record<string, string> = {
    "api-key": "C69BAF41DA5ABD1FFEDC6D2FEA56B",
    accept: "application/vnd.picacomic.com.v1+json",
    "app-channel": "2",
    time,
    nonce: "ptxdhmjzqtnrtwndhbxcpkjamb33w837",
    "app-version": "2.2.1.2.3.3",
    "app-uuid": "defaultUuid",
    "app-platform": "android",
    "app-build-version": "44",
    "Content-Type": "application/json; charset=UTF-8",
    "User-Agent": "okhttp/3.8.1",
    "image-quality": "original",
    signature,
  };
  if (token) headers.authorization = token;
  try {
    const response = await send(`${PICA_HOST}${path}`, {
      method,
      headers,
      body: body ?? undefined,
      signal: AbortSignal.timeout(20_000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      await discard(response);
      return { status: 502, body: "Pica API 返回了不允许的重定向" };
    }
    if (Number(response.headers.get("content-length") ?? 0) > MAX_API_RESPONSE_BYTES) {
      await discard(response);
      return { status: 413, body: "Pica API 响应过大" };
    }
    const stream = limitedResponseBody(response.body, MAX_API_RESPONSE_BYTES, "Pica API 响应过大");
    return { status: response.status, body: await new Response(stream).text() };
  } catch (error) {
    return { status: 502, body: `哔咔 API 网络错误：${(error as Error).message}` };
  }
}

export async function relayPicaImage(url: string, send: OutboundFetch): Promise<Response> {
  if (!isAllowedPicaImageUrl(url)) return new Response("不允许的图片地址", { status: 403 });
  // Redirects and streaming share a single deadline, so each hop cannot restart the timeout.
  const signal = AbortSignal.timeout(30_000);
  try {
    let currentUrl = url;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await send(currentUrl, {
        headers: { "User-Agent": "okhttp/3.8.1", accept: "image/avif,image/webp,image/*,*/*" },
        signal,
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const nextUrl = location && nextPicaImageUrl(currentUrl, location);
        await discard(response);
        if (!nextUrl) return new Response("图片重定向到不允许的域名", { status: 403 });
        if (redirect === MAX_REDIRECTS) return new Response("图片重定向次数过多", { status: 508 });
        currentUrl = nextUrl;
        continue;
      }
      if (!response.ok) {
        await discard(response);
        return new Response(`图片请求失败：HTTP ${response.status}`, { status: response.status });
      }
      if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_RESPONSE_BYTES) {
        await discard(response);
        return new Response("图片响应过大", { status: 413 });
      }
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      if (!/^image\//i.test(contentType) && contentType !== "application/octet-stream") {
        await discard(response);
        return new Response("上游没有返回图片", { status: 415 });
      }
      return new Response(limitedResponseBody(response.body, MAX_IMAGE_RESPONSE_BYTES), {
        status: response.status,
        headers: { "content-type": contentType, "cache-control": "no-store" },
      });
    }
    return new Response("图片重定向次数过多", { status: 508 });
  } catch (error) {
    return new Response(`图片下载失败：${(error as Error).message}`, { status: 502 });
  }
}
