// 仅在开发环境的 Node 运行时中被 relay.ts 动态加载：
// picaapi 与图床在境内被墙，开发时出站请求需要经本地科学上网代理转发。
// 生产环境（Cloudflare Workers）直连即可，本模块不会进入产物。
import type { Dispatcher } from "undici";

let cachedUrl = "";
let cachedAgent: Dispatcher | null = null;

export async function getDevDispatcher(): Promise<Dispatcher> {
  const proxyUrl =
    process.env.PICA_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    // 本机默认走 v2rayN 的混合端口；换工具时用 PICA_PROXY_URL 覆盖。
    "http://127.0.0.1:10808";
  if (cachedAgent && cachedUrl === proxyUrl) return cachedAgent;
  const { ProxyAgent } = await import("undici");
  cachedAgent = new ProxyAgent(proxyUrl);
  cachedUrl = proxyUrl;
  return cachedAgent;
}
