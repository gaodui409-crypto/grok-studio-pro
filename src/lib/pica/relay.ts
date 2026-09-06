// 哔咔 API 的服务端中转。
// 浏览器禁止 fetch 覆盖 User-Agent，而哔咔 API 拒绝浏览器 UA（返回 401 unauthorized），
// 所以请求必须从服务端发出，由这里注入 okhttp UA 并计算签名。
import { createServerFn } from "@tanstack/react-start";
import { signRequest } from "./hmac";

const PICA_HOST = "https://picaapi.picacomic.com/";
const API_KEY = "C69BAF41DA5ABD1FFEDC6D2FEA56B";
const NONCE = "ptxdhmjzqtnrtwndhbxcpkjamb33w837";

export type PicaApiResult = { status: number; body: string };

export type PicaApiRequestArgs = {
  method: "GET" | "POST";
  path: string;
  body: string | null;
  token: string | null;
};

// 本中转只会发 JSON 字符串，body/headers 收窄以兼容 undici 的 RequestInit 类型。
type OutboundInit = Omit<RequestInit, "body" | "headers"> & {
  body?: string;
  headers?: Record<string, string>;
};

async function outboundFetch(url: string, init: OutboundInit): Promise<Response> {
  // 开发环境（Node 运行时）经本地代理出国；Workers 等生产运行时直连。
  if (import.meta.env.DEV && typeof process !== "undefined" && process.versions?.node) {
    try {
      const [{ getDevDispatcher }, { fetch: undiciFetch }] = await Promise.all([
        import("./dev-dispatcher"),
        import("undici"),
      ]);
      const dispatcher = await getDevDispatcher();
      return undiciFetch(url, { ...init, dispatcher }) as unknown as Response;
    } catch (e) {
      console.warn("[pica] 本地代理不可用，改为直连 picaapi", e);
    }
  }
  return fetch(url, init);
}

export const picaApiRequest = createServerFn({ method: "POST" })
  .inputValidator((input: PicaApiRequestArgs) => input)
  .handler(async ({ data }): Promise<PicaApiResult> => {
    const { method, path, body, token } = data;
    const time = String(Math.floor(Date.now() / 1000));
    const signature = await signRequest(path, method, time);
    const headers: Record<string, string> = {
      "api-key": API_KEY,
      accept: "application/vnd.picacomic.com.v1+json",
      "app-channel": "2",
      time,
      nonce: NONCE,
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
      const resp = await outboundFetch(`${PICA_HOST}${path}`, {
        method,
        headers,
        body: body ?? undefined,
        signal: AbortSignal.timeout(20_000),
      });
      return { status: resp.status, body: await resp.text() };
    } catch (e) {
      return { status: 502, body: `哔咔 API 网络错误：${(e as Error).message}` };
    }
  });

function isAllowedImageHost(hostname: string): boolean {
  return (
    hostname === "picacomic.com" ||
    hostname === "picaapi.picacomic.com" ||
    hostname.endsWith(".picacomic.com") ||
    hostname.endsWith(".picacomic.com.cn") ||
    /^storage\d*(-pic)?\.(icu|com|net)$/.test(hostname)
  );
}

export const picaImageFetch = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<Response> => {
    let host = "";
    try {
      host = new URL(data.url).hostname;
    } catch {
      // host 保持为空，走 403 分支
    }
    if (!host || !isAllowedImageHost(host)) {
      return new Response(`不允许的图片域名：${host || data.url}`, { status: 403 });
    }
    try {
      const resp = await outboundFetch(data.url, {
        headers: { "User-Agent": "okhttp/3.8.1", accept: "image/avif,image/webp,image/*,*/*" },
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });
      return new Response(resp.body as unknown as BodyInit, {
        status: resp.status,
        headers: {
          "content-type": resp.headers.get("content-type") ?? "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    } catch (e) {
      return new Response(`图片下载失败：${(e as Error).message}`, { status: 502 });
    }
  });
